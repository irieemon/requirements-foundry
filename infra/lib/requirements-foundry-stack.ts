import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
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

    // ALB Security Group: allow TCP/80 from RFC1918 ranges (corporate network)
    this.albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: 'requirements-foundry-prod-alb-sg',
      description: 'ALB security group - allows HTTP from corporate networks',
      allowAllOutbound: true,
    });
    this.albSg.addIngressRule(ec2.Peer.ipv4('10.0.0.0/8'), ec2.Port.tcp(80), 'Allow HTTP from 10.0.0.0/8');
    this.albSg.addIngressRule(ec2.Peer.ipv4('172.16.0.0/12'), ec2.Port.tcp(80), 'Allow HTTP from 172.16.0.0/12');
    this.albSg.addIngressRule(ec2.Peer.ipv4('192.168.0.0/16'), ec2.Port.tcp(80), 'Allow HTTP from 192.168.0.0/16');

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

    // RDS PostgreSQL (DB-01, DB-02)
    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: 'requirements-foundry-prod-rds',
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.rdsSg],
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

    // Tags
    cdk.Tags.of(this).add('Project', 'requirements-foundry');
    cdk.Tags.of(this).add('Environment', 'prod');
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
