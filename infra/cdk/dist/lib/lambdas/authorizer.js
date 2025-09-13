"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_jwt_verify_1 = require("aws-jwt-verify");
const requiredEnv = (name) => {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env ${name}`);
    return v;
};
const issuer = requiredEnv('JWT_ISSUER');
const audience = requiredEnv('JWT_AUDIENCE');
const jwksFromEnv = process.env.JWKS_URI;
const normalizedIssuer = issuer.replace(/\/$/, '');
const jwksUri = (jwksFromEnv && jwksFromEnv.length > 0)
    ? jwksFromEnv
    : `${normalizedIssuer}/.well-known/jwks.json`;
const verifier = aws_jwt_verify_1.JwtRsaVerifier.create({
    issuer,
    audience,
    jwksUri,
});
function policy(principalId, effect, resource, context) {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
        context,
    };
}
const handler = async (event) => {
    try {
        const raw = event.authorizationToken || '';
        const token = raw.replace(/^Bearer\s+/i, '');
        if (!token) {
            throw new Error('Missing token');
        }
        const claims = await verifier.verify(token);
        const principalId = claims.sub || 'user';
        const context = {};
        for (const [key, value] of Object.entries(claims)) {
            if (typeof value === 'string' && key.length <= 100 && value.length <= 1000) {
                context[key] = value;
            }
        }
        return policy(principalId, 'Allow', event.methodArn, context);
    }
    catch (_err) {
        return policy('anonymous', 'Deny', event.methodArn);
    }
};
exports.handler = handler;
