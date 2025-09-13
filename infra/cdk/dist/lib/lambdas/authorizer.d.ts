import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
export declare const handler: (event: APIGatewayTokenAuthorizerEvent) => Promise<APIGatewayAuthorizerResult>;
