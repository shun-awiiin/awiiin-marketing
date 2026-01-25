import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";

// SQS Client singleton
let sqsClient: SQSClient | null = null;

function getSQSClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "ap-northeast-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sqsClient;
}

export interface EmailQueueMessage {
  messageId: string; // DB上のmessages.id
  campaignId: string;
}

/**
 * 単一のメッセージをSQSに送信
 */
export async function sendToEmailQueue(
  message: EmailQueueMessage
): Promise<string | undefined> {
  const queueUrl = process.env.SQS_EMAIL_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_EMAIL_QUEUE_URL is not configured");
  }

  const client = getSQSClient();
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    MessageGroupId: message.campaignId, // FIFO用（オプション）
  });

  const response = await client.send(command);
  return response.MessageId;
}

/**
 * 複数のメッセージをバッチでSQSに送信
 * SQSのバッチは最大10件なので、内部で分割して送信
 */
export async function sendBatchToEmailQueue(
  messages: EmailQueueMessage[]
): Promise<{ successful: number; failed: number }> {
  const queueUrl = process.env.SQS_EMAIL_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_EMAIL_QUEUE_URL is not configured");
  }

  const client = getSQSClient();
  const batchSize = 10; // SQSの最大バッチサイズ
  let successful = 0;
  let failed = 0;

  // 10件ずつ分割して送信
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const entries: SendMessageBatchRequestEntry[] = batch.map((msg, index) => ({
      Id: `msg-${i + index}`,
      MessageBody: JSON.stringify(msg),
    }));

    try {
      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      });

      const response = await client.send(command);
      successful += response.Successful?.length || 0;
      failed += response.Failed?.length || 0;

      if (response.Failed && response.Failed.length > 0) {
        console.error("SQS batch send failures:", response.Failed);
      }
    } catch (error) {
      console.error("SQS batch send error:", error);
      failed += batch.length;
    }
  }

  return { successful, failed };
}

/**
 * キャンペーンのメッセージIDリストをSQSに投入
 */
export async function queueCampaignMessages(
  campaignId: string,
  messageIds: string[]
): Promise<{ successful: number; failed: number }> {
  const messages: EmailQueueMessage[] = messageIds.map((messageId) => ({
    messageId,
    campaignId,
  }));

  return sendBatchToEmailQueue(messages);
}
