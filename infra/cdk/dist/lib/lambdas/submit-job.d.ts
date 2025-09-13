export declare const handler: (event: any) => Promise<{
    statusCode: number;
    headers: {
        'content-type': string;
    };
    body: string;
}>;
