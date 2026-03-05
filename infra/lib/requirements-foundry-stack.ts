import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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

    // Tags
    cdk.Tags.of(this).add('Project', 'requirements-foundry');
    cdk.Tags.of(this).add('Environment', 'prod');
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
