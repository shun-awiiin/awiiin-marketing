/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "hubspot-alternative",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "ap-northeast-1",
        },
      },
    };
  },
  async run() {
    // Dead Letter Queue for failed messages
    const dlq = new sst.aws.Queue("EmailDLQ", {
      visibilityTimeout: "5 minutes",
    });

    // Main email send queue
    const emailQueue = new sst.aws.Queue("EmailSendQueue", {
      visibilityTimeout: "2 minutes",
      dlq: {
        queue: dlq.arn,
        retry: 3, // 3回失敗後にDLQへ
      },
    });

    // Connect queue to worker (batch processing)
    // SST v3: subscribe に直接ハンドラーを指定
    emailQueue.subscribe({
      handler: "packages/functions/email-worker.handler",
      timeout: "60 seconds",
      memory: "256 MB",
      environment: {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        AWS_SES_REGION: process.env.AWS_REGION || "ap-northeast-1",
        AWS_SES_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
        AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "",
        SES_FROM_NAME: process.env.SES_FROM_NAME || "",
      },
      permissions: [
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        },
      ],
    }, {
      batch: {
        size: 10, // 10件ずつ処理
        window: "10 seconds",
      },
    });

    // Output the queue URL for the Next.js app
    return {
      queueUrl: emailQueue.url,
      queueArn: emailQueue.arn,
      dlqUrl: dlq.url,
    };
  },
});
