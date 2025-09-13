export declare const handler: (event: any) => Promise<{
    statusCode: number;
    body: string;
    headers?: undefined;
} | {
    statusCode: number;
    headers: {
        'content-type': string;
    };
    body: string;
}>;
