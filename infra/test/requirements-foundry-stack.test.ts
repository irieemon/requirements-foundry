import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RequirementsFoundryStack } from '../lib/requirements-foundry-stack';

describe('RequirementsFoundryStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new RequirementsFoundryStack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });
    template = Template.fromStack(stack);
  });

  describe('VPC', () => {
    test('creates VPC with CIDR 10.0.0.0/16', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
      });
    });
  });

  describe('NAT Gateway', () => {
    test('creates exactly 1 NAT Gateway', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 1);
    });
  });

  describe('Security Groups', () => {
    test('ALB security group has ingress rules for RFC1918 ranges on port 80', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: Match.stringLikeRegexp('ALB'),
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            CidrIp: '10.0.0.0/8',
            FromPort: 80,
            IpProtocol: 'tcp',
            ToPort: 80,
          }),
          Match.objectLike({
            CidrIp: '172.16.0.0/12',
            FromPort: 80,
            IpProtocol: 'tcp',
            ToPort: 80,
          }),
          Match.objectLike({
            CidrIp: '192.168.0.0/16',
            FromPort: 80,
            IpProtocol: 'tcp',
            ToPort: 80,
          }),
        ]),
      });
    });

    test('ECS security group has ingress from ALB security group on port 3000', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
        IpProtocol: 'tcp',
        FromPort: 3000,
        ToPort: 3000,
        GroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('EcsSg'),
          ]),
        }),
        SourceSecurityGroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('AlbSg'),
          ]),
        }),
      });
    });

    test('RDS security group has ingress from ECS security group on port 5432', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        GroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('RdsSg'),
          ]),
        }),
        SourceSecurityGroupId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('EcsSg'),
          ]),
        }),
      });
    });
  });

  describe('VPC Endpoints', () => {
    test('S3 Gateway VPC Endpoint exists', () => {
      template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        ServiceName: Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              Match.stringLikeRegexp('s3'),
            ]),
          ]),
        }),
        VpcEndpointType: 'Gateway',
      });
    });

    test('Bedrock Runtime Interface VPC Endpoint exists', () => {
      template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        ServiceName: 'com.amazonaws.us-east-1.bedrock-runtime',
        VpcEndpointType: 'Interface',
        PrivateDnsEnabled: true,
      });
    });
  });
});
