#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DeepCopyStack } from '../lib/deep-copy-stack';

const app = new cdk.App();

new DeepCopyStack(app, 'DeepCopyStack', {
  env: {
    // Target AWS account/region for deployment
    account: '613663743323',
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
});


