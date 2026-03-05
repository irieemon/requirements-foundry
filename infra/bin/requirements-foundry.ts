#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { RequirementsFoundryStack } from '../lib/requirements-foundry-stack';

const app = new cdk.App();
new RequirementsFoundryStack(app, 'RequirementsFoundryStack', {
  env: { region: 'us-east-1' },
});
