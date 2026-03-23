import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class RequirementsFoundryStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSg: ec2.SecurityGroup;
  public readonly ecsSg: ec2.SecurityGroup;
  public readonly rdsSg: ec2.SecurityGroup;
  public readonly endpointSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 3 subnet tiers across 2 AZs, single NAT Gateway for POC cost savings
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'requirements-foundry-prod-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { cidrMask: 24, name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { cidrMask: 24, name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // ALB Security Group: allow TCP/80 from anywhere (POC - restrict after VPN setup)
    this.albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      description: 'ALB security group - allows HTTP (POC: open to internet)',
      allowAllOutbound: true,
    });
    this.albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from anywhere (POC)');

    // ECS Security Group: allow TCP/3000 from ALB only
    this.ecsSg = new ec2.SecurityGroup(this, 'EcsSg', {
      vpc: this.vpc,
      securityGroupName: 'requirements-foundry-prod-ecs-sg',
      description: 'ECS security group - allows traffic from ALB on port 3000',
      allowAllOutbound: true,
    });
    this.ecsSg.addIngressRule(this.albSg, ec2.Port.tcp(3000), 'Allow from ALB on port 3000');

    // RDS Security Group: allow TCP/5432 from ECS only, no outbound
    this.rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc: this.vpc,
      securityGroupName: 'requirements-foundry-prod-rds-sg',
      description: 'RDS security group - allows traffic from ECS on port 5432',
      allowAllOutbound: false,
    });
    this.rdsSg.addIngressRule(this.ecsSg, ec2.Port.tcp(5432), 'Allow from ECS on port 5432');

    // VPC Endpoint Security Group: allow TCP/443 from ECS only, no outbound
    this.endpointSg = new ec2.SecurityGroup(this, 'EndpointSg', {
      vpc: this.vpc,
      securityGroupName: 'requirements-foundry-prod-endpoint-sg',
      description: 'VPC Endpoint security group - allows HTTPS from ECS',
      allowAllOutbound: false,
    });
    this.endpointSg.addIngressRule(this.ecsSg, ec2.Port.tcp(443), 'Allow HTTPS from ECS');

    // S3 Gateway Endpoint (free) - add to both private subnet types
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Bedrock Runtime Interface Endpoint
    this.vpc.addInterfaceEndpoint('BedrockEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.endpointSg],
      privateDnsEnabled: true,
    });

    // RDS Parameter Group - enforce SSL connections (DB-04)
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
      description: 'Requirements Foundry RDS parameter group',
      parameters: {
        'rds.force_ssl': '1',
      },
    });

    // RDS PostgreSQL (DB-01, DB-02)
    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: 'requirements-foundry-prod-rds',
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.rdsSg],
      parameterGroup,
      databaseName: 'requirements_foundry',
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: 'requirements-foundry-prod/rds-credentials',
      }),
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      multiAz: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DATABASE_URL Secret placeholder (SEC-01)
    const databaseUrlSecret = new secretsmanager.Secret(this, 'DatabaseUrlSecret', {
      secretName: 'requirements-foundry-prod/database-url',
      description: 'Composed DATABASE_URL for the application. Value set post-deploy or via entrypoint script.',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Bucket for uploads (STOR-01)
    const bucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: 'requirements-foundry-prod-uploads',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
    });

    // ECR Repository (CMP-03)
    const repository = new ecr.Repository(this, 'Repository', {
      repositoryName: 'requirements-foundry-prod',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
    repository.addLifecycleRule({ maxImageCount: 10, description: 'Keep last 10 images' });

    // ECS Cluster (CMP-02)
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'requirements-foundry-prod-cluster',
      vpc: this.vpc,
      containerInsights: true,
    });

    // SSM Parameters for non-sensitive config (SEC-02)
    new ssm.StringParameter(this, 'BucketNameParam', {
      parameterName: '/requirements-foundry/prod/s3-bucket-name',
      stringValue: bucket.bucketName,
      description: 'S3 bucket name for file uploads',
    });
    new ssm.StringParameter(this, 'RegionParam', {
      parameterName: '/requirements-foundry/prod/aws-region',
      stringValue: 'us-east-1',
      description: 'AWS region for the application',
    });
    new ssm.StringParameter(this, 'EcrRepoParam', {
      parameterName: '/requirements-foundry/prod/ecr-repo-uri',
      stringValue: repository.repositoryUri,
      description: 'ECR repository URI for container images',
    });

    // Internet-facing ALB (POC - switch to internal after VPN setup)
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: this.albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // ALB Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: this.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/api/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ALB Listener - default 503 response (no targets yet)
    const listener = alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(503, {
        contentType: 'text/plain',
        messageBody: 'Service not yet deployed',
      }),
    });

    // Add target group as secondary action -- Phase 23 will switch to forwarding
    listener.addTargetGroups('AppTargets', {
      targetGroups: [targetGroup],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
      priority: 1,
    });

    // --- CloudFront Distribution (HTTPS for Cognito OAuth) ---
    // HTTP origin to ALB, HTTPS to viewers. All caching disabled for dynamic Next.js app.
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Requirements Foundry - HTTPS termination for Cognito OAuth',
      defaultBehavior: {
        origin: new origins.HttpOrigin(alb.loadBalancerDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 80,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // IAM Task Execution Role (SEC-03)
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: 'requirements-foundry-prod-task-execution',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    // Grant read access to secrets
    dbInstance.secret!.grantRead(taskExecutionRole);
    databaseUrlSecret.grantRead(taskExecutionRole);

    // IAM Task Role (SEC-04)
    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: 'requirements-foundry-prod-task',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    // Secrets Manager read for RDS credentials (used by entrypoint.js at runtime)
    dbInstance.secret!.grantRead(taskRole);
    // S3 read/write for file uploads
    bucket.grantReadWrite(taskRole);
    // Bedrock invoke model
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    // CloudWatch Logs (for container logging)
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));

    // CloudWatch Log Group (CMP-04)
    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: '/ecs/requirements-foundry-prod',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Fargate Task Definition (CMP-01)
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: 'requirements-foundry-prod',
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // CRON_SECRET in Secrets Manager (for Lambda cron caller + ECS container validation)
    const cronSecret = new secretsmanager.Secret(this, 'CronSecret', {
      secretName: 'requirements-foundry-prod/cron-secret',
      generateSecretString: { excludePunctuation: true, passwordLength: 32 },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SESSION_SECRET in Secrets Manager (for iron-session cookie encryption)
    const sessionSecret = new secretsmanager.Secret(this, 'SessionSecret', {
      secretName: 'requirements-foundry-prod/session-secret',
      generateSecretString: { excludePunctuation: false, passwordLength: 64 },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant task execution role read access to CRON_SECRET
    cronSecret.grantRead(taskExecutionRole);
    sessionSecret.grantRead(taskExecutionRole);

    // --- Phase 26: Cognito Infrastructure ---

    // Cognito User Pool (INFRA-01)
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'requirements-foundry-prod',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
        familyName: { required: false, mutable: true },
      },
      customAttributes: {
        groups: new cognito.StringAttribute({ mutable: true }),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognito Domain (for Hosted UI)
    const cognitoDomainPrefix = this.node.tryGetContext('cognitoDomainPrefix') || 'requirements-foundry-prod';
    const cognitoDomain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: cognitoDomainPrefix,
      },
    });

    // Okta SAML Identity Provider (INFRA-01)
    // Use file-based metadata (placeholder) until real Okta app is configured,
    // then switch to URL-based: cognito.UserPoolIdentityProviderSamlMetadata.url(oktaMetadataUrl)
    const oktaMetadataUrl = this.node.tryGetContext('oktaMetadataUrl');
    const samlMetadataXml = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'saml-metadata-placeholder.xml'), 'utf-8'
    );

    const samlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'OktaSamlIdp', {
      userPool,
      name: 'Okta',
      metadata: oktaMetadataUrl
        ? cognito.UserPoolIdentityProviderSamlMetadata.url(oktaMetadataUrl)
        : cognito.UserPoolIdentityProviderSamlMetadata.file(samlMetadataXml),
      attributeMapping: {
        email: cognito.ProviderAttribute.other('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
        custom: {
          'custom:groups': cognito.ProviderAttribute.other('groups'),
        },
      },
    });

    // PreTokenGeneration Lambda (INFRA-02)
    const preTokenFn = new lambda.Function(this, 'PreTokenGenerationFn', {
      functionName: 'requirements-foundry-pre-token-generation',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/pre-token-generation'),
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      logGroup: logs.LogGroup.fromLogGroupName(this, 'PreTokenLogGroup',
        '/aws/lambda/requirements-foundry-pre-token-generation'),
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      preTokenFn,
      cognito.LambdaVersion.V2_0,
    );

    // User Pool Client (INFRA-01)
    // CloudFront provides HTTPS termination for Cognito OAuth callbacks.
    const redirectUri = `https://${distribution.distributionDomainName}/api/auth/callback`;
    const cognitoClient = userPool.addClient('AppClient', {
      userPoolClientName: 'requirements-foundry-app',
      generateSecret: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          redirectUri,
          'http://localhost:3000/api/auth/callback',
        ],
        logoutUrls: [
          `https://${distribution.distributionDomainName}/`,
          'http://localhost:3000/',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        // Re-enable when IT configures the real Okta SAML app:
        // cognito.UserPoolClientIdentityProvider.custom('Okta'),
      ],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });
    cognitoClient.node.addDependency(samlProvider);

    // Extract client secret via AwsCustomResource (INFRA-03)
    const describeCognitoClient = new cr.AwsCustomResource(this, 'DescribeCognitoClient', {
      resourceType: 'Custom::DescribeCognitoUserPoolClient',
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'describeUserPoolClient',
        parameters: {
          UserPoolId: userPool.userPoolId,
          ClientId: cognitoClient.userPoolClientId,
        },
        physicalResourceId: cr.PhysicalResourceId.of(cognitoClient.userPoolClientId),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'describeUserPoolClient',
        parameters: {
          UserPoolId: userPool.userPoolId,
          ClientId: cognitoClient.userPoolClientId,
        },
        physicalResourceId: cr.PhysicalResourceId.of(cognitoClient.userPoolClientId),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Cognito client credentials in Secrets Manager (INFRA-03)
    const cognitoSecret = new secretsmanager.Secret(this, 'CognitoClientSecret', {
      secretName: 'requirements-foundry-prod/cognito-client',
      description: 'Cognito App Client credentials',
      secretObjectValue: {
        userPoolId: cdk.SecretValue.unsafePlainText(userPool.userPoolId),
        clientId: cdk.SecretValue.unsafePlainText(cognitoClient.userPoolClientId),
        clientSecret: cdk.SecretValue.unsafePlainText(
          describeCognitoClient.getResponseField('UserPoolClient.ClientSecret')
        ),
        domain: cdk.SecretValue.unsafePlainText(
          `${cognitoDomainPrefix}.auth.us-east-1.amazoncognito.com`
        ),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant task execution role read access to Cognito secret
    cognitoSecret.grantRead(taskExecutionRole);

    // Container
    taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'app', logGroup }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        AWS_REGION: 'us-east-1',
        S3_BUCKET_NAME: bucket.bucketName,
        RDS_SECRET_NAME: 'requirements-foundry-prod/rds-credentials',
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: cognitoClient.userPoolClientId,
        COGNITO_DOMAIN: `${cognitoDomainPrefix}.auth.us-east-1.amazoncognito.com`,
        COGNITO_REDIRECT_URI: redirectUri,
      },
      secrets: {
        CRON_SECRET: ecs.Secret.fromSecretsManager(cronSecret),
        COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret),
        SESSION_SECRET: ecs.Secret.fromSecretsManager(sessionSecret),
      },
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
    });

    // Fargate Service
    const service = new ecs.FargateService(this, 'Service', {
      serviceName: 'requirements-foundry-prod-service',
      cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [this.ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { enable: true, rollback: false },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Wire Fargate service to ALB target group
    service.attachToApplicationTargetGroup(targetGroup);

    // --- Phase 24: CI/CD and Operations Infrastructure ---

    // GitHub OIDC Provider + IAM Role (CICD-02) — retained for CloudFormation stability
    const githubRepo = this.node.tryGetContext('githubRepo') || 'irieemon/requirements-foundry';

    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'requirements-foundry-github-actions',
      assumedBy: new iam.WebIdentityPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:ref:refs/heads/main`,
          },
        },
      ),
    });

    // Minimum permissions: ECR pull+push (Buildx needs pull for manifest checks) + ECS deploy
    repository.grantPullPush(deployRole);
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:UpdateService',
        'ecs:DescribeServices',
        'ecs:DescribeTaskDefinition',
      ],
      resources: ['*'],
    }));

    // --- CodePipeline + CodeBuild (ARM64 native builds) ---

    // CodeStar Connection to GitHub (must be confirmed in AWS Console after first deploy)
    const connectionArn = this.node.tryGetContext('codestarConnectionArn')
      || 'PENDING';
    const [githubOwner, githubRepoName] = githubRepo.split('/');

    // CodeBuild project: ARM64 native, large compute, Docker-privileged
    const buildProject = new codebuild.PipelineProject(this, 'DockerBuild', {
      projectName: 'requirements-foundry-build',
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.LARGE,
        privileged: true,
      },
      environmentVariables: {
        REPOSITORY_URI: { value: repository.repositoryUri },
        CONTAINER_NAME: { value: 'AppContainer' },
        ECS_CLUSTER: { value: cluster.clusterName },
        ECS_SERVICE: { value: 'requirements-foundry-prod-service' },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'docker pull $REPOSITORY_URI:latest || true',
              'docker build --cache-from $REPOSITORY_URI:latest -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing Docker image...',
              'docker push $REPOSITORY_URI:latest',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'printf \'[{"name":"%s","imageUri":"%s"}]\' $CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
              'echo Build completed on `date`',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
        },
      }),
      timeout: cdk.Duration.minutes(20),
    });

    // Grant CodeBuild ECR access
    repository.grantPullPush(buildProject);

    // CodePipeline: Source → Build → Deploy
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    const pipeline = new codepipeline.Pipeline(this, 'DeployPipeline', {
      pipelineName: 'requirements-foundry-deploy',
      pipelineType: codepipeline.PipelineType.V2,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub_Source',
              owner: githubOwner,
              repo: githubRepoName,
              branch: 'main',
              output: sourceOutput,
              connectionArn,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Docker_Build',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.EcsDeployAction({
              actionName: 'ECS_Deploy',
              service,
              input: buildOutput,
              deploymentTimeout: cdk.Duration.minutes(15),
            }),
          ],
        },
      ],
    });

    // Lambda cron caller function (CRON-01)
    const cronLambda = new lambda.Function(this, 'CronCallerLambda', {
      functionName: 'requirements-foundry-cron-caller',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const http = require('http');

exports.handler = async () => {
  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
  );

  return new Promise((resolve, reject) => {
    const req = http.request(process.env.ENDPOINT_URL, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + SecretString },
      timeout: 25000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('Status:', res.statusCode, 'Body:', body);
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};
      `),
      environment: {
        SECRET_NAME: cronSecret.secretName,
        ENDPOINT_URL: `http://${alb.loadBalancerDnsName}/api/cron/recover-stale-runs`,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
    });

    // Grant Lambda read access to the cron secret
    cronSecret.grantRead(cronLambda);

    // EventBridge rule: every 5 minutes (CRON-01)
    new events.Rule(this, 'CronSchedule', {
      ruleName: 'requirements-foundry-cron-schedule',
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(cronLambda)],
    });

    // SNS Topic for alarm notifications (OPS-03)
    const alarmEmail = this.node.tryGetContext('alarmEmail');

    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'requirements-foundry-alarms',
    });

    if (alarmEmail) {
      alarmTopic.addSubscription(
        new sns_subscriptions.EmailSubscription(alarmEmail),
      );
    }

    const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);

    // Alarm 1: ECS running task count = 0 (OPS-02)
    // Uses ECS/ContainerInsights namespace (Container Insights already enabled on cluster)
    const taskCountAlarm = new cloudwatch.Alarm(this, 'EcsTaskCountAlarm', {
      alarmName: 'rf-prod-ecs-no-running-tasks',
      metric: new cloudwatch.Metric({
        namespace: 'ECS/ContainerInsights',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: cluster.clusterName,
          ServiceName: service.serviceName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    taskCountAlarm.addAlarmAction(snsAction);

    // Alarm 2: ALB unhealthy target count > 0 (OPS-02)
    const unhealthyTargetAlarm = new cloudwatch.Alarm(this, 'AlbUnhealthyTargetAlarm', {
      alarmName: 'rf-prod-alb-unhealthy-targets',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          TargetGroup: targetGroup.targetGroupFullName,
          LoadBalancer: alb.loadBalancerFullName,
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    unhealthyTargetAlarm.addAlarmAction(snsAction);

    // Alarm 3: RDS CPU > 80% (OPS-02)
    const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName: 'rf-prod-rds-high-cpu',
      metric: dbInstance.metric('CPUUtilization', {
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 80,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.MISSING,
    });
    rdsCpuAlarm.addAlarmAction(snsAction);

    // Stack Outputs
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId, exportName: 'rf-prod-vpc-id' });
    new cdk.CfnOutput(this, 'AlbDnsName', { value: alb.loadBalancerDnsName, exportName: 'rf-prod-alb-dns' });
    new cdk.CfnOutput(this, 'AlbArn', { value: alb.loadBalancerArn, exportName: 'rf-prod-alb-arn' });
    new cdk.CfnOutput(this, 'TargetGroupArn', { value: targetGroup.targetGroupArn, exportName: 'rf-prod-tg-arn' });
    new cdk.CfnOutput(this, 'RdsEndpoint', { value: dbInstance.dbInstanceEndpointAddress, exportName: 'rf-prod-rds-endpoint' });
    new cdk.CfnOutput(this, 'RdsSecretArn', { value: dbInstance.secret!.secretArn, exportName: 'rf-prod-rds-secret-arn' });
    new cdk.CfnOutput(this, 'DatabaseUrlSecretArn', { value: databaseUrlSecret.secretArn, exportName: 'rf-prod-db-url-secret-arn' });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName, exportName: 'rf-prod-bucket-name' });
    new cdk.CfnOutput(this, 'EcrRepoUri', { value: repository.repositoryUri, exportName: 'rf-prod-ecr-repo-uri' });
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName, exportName: 'rf-prod-cluster-name' });
    new cdk.CfnOutput(this, 'ClusterArn', { value: cluster.clusterArn, exportName: 'rf-prod-cluster-arn' });
    new cdk.CfnOutput(this, 'TaskExecutionRoleArn', { value: taskExecutionRole.roleArn, exportName: 'rf-prod-exec-role-arn' });
    new cdk.CfnOutput(this, 'TaskRoleArn', { value: taskRole.roleArn, exportName: 'rf-prod-task-role-arn' });
    new cdk.CfnOutput(this, 'EcsSgId', { value: this.ecsSg.securityGroupId, exportName: 'rf-prod-ecs-sg-id' });
    new cdk.CfnOutput(this, 'ServiceName', { value: service.serviceName, exportName: 'rf-prod-service-name' });
    new cdk.CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName, exportName: 'rf-prod-log-group' });
    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', { value: deployRole.roleArn, exportName: 'rf-prod-github-role-arn' });
    new cdk.CfnOutput(this, 'PipelineName', { value: pipeline.pipelineName, exportName: 'rf-prod-pipeline-name' });
    new cdk.CfnOutput(this, 'CronSecretArn', { value: cronSecret.secretArn, exportName: 'rf-prod-cron-secret-arn' });
    new cdk.CfnOutput(this, 'AlarmTopicArn', { value: alarmTopic.topicArn, exportName: 'rf-prod-alarm-topic-arn' });
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      exportName: 'rf-prod-cf-domain',
      description: 'CloudFront distribution domain — use this as the app URL',
    });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      exportName: 'rf-prod-cf-distribution-id',
    });

    // Cognito Outputs (Phase 26)
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      exportName: 'rf-prod-cognito-user-pool-id',
    });
    new cdk.CfnOutput(this, 'CognitoEntityId', {
      value: `urn:amazon:cognito:sp:${userPool.userPoolId}`,
      exportName: 'rf-prod-cognito-entity-id',
      description: 'Set this as Audience URI (SP Entity ID) in Okta SAML app',
    });
    new cdk.CfnOutput(this, 'CognitoAcsUrl', {
      value: `https://${cognitoDomainPrefix}.auth.us-east-1.amazoncognito.com/saml2/idpresponse`,
      exportName: 'rf-prod-cognito-acs-url',
      description: 'Set this as Single Sign On URL in Okta SAML app',
    });
    new cdk.CfnOutput(this, 'CognitoHostedUiUrl', {
      value: cognitoDomain.signInUrl(cognitoClient, {
        redirectUri,
      }),
      exportName: 'rf-prod-cognito-hosted-ui-url',
      description: 'Use this URL to test SAML login via Cognito Hosted UI',
    });
    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: cognitoClient.userPoolClientId,
      exportName: 'rf-prod-cognito-client-id',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'requirements-foundry');
    cdk.Tags.of(this).add('Environment', 'prod');
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
