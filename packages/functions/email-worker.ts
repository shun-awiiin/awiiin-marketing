import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { createClient } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const AWS_SES_REGION = process.env.AWS_SES_REGION || "ap-northeast-1";
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || "";
const SES_FROM_NAME = process.env.SES_FROM_NAME || "";

// Clients
const sesClient = new SESClient({
  region: AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || "",
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface QueueMessage {
  messageId: string;
  campaignId: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

/**
 * SQS Lambda Handler
 * バッチで最大10件のメッセージを処理
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  console.log(`Processing ${event.Records.length} messages`);

  for (const record of event.Records) {
    try {
      const queueMessage: QueueMessage = JSON.parse(record.body);
      const { messageId, campaignId } = queueMessage;

      // キャンペーンステータスを確認（stopped なら中断）
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("status, from_name, from_email")
        .eq("id", campaignId)
        .single();

      if (!campaign || !["queued", "sending"].includes(campaign.status)) {
        console.log(`Campaign ${campaignId} is not in sendable state: ${campaign?.status}`);
        // ステータスが送信可能でない場合はスキップ（成功扱い）
        continue;
      }

      // メッセージ詳細を取得
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .single();

      if (messageError || !message) {
        console.error(`Message not found: ${messageId}`);
        continue;
      }

      // 既に送信済みの場合はスキップ
      if (message.status === "sent" || message.status === "delivered") {
        console.log(`Message ${messageId} already sent`);
        continue;
      }

      // ステータスを sending に更新
      await supabase
        .from("messages")
        .update({ status: "sending" })
        .eq("id", messageId);

      // メール送信
      const fromName = campaign.from_name || SES_FROM_NAME;
      const fromEmail = campaign.from_email || SES_FROM_EMAIL;

      const result = await sendEmailWithSES(
        message.to_email,
        message.subject,
        message.body_text,
        fromName,
        fromEmail
      );

      if (result.success) {
        // 成功
        await supabase
          .from("messages")
          .update({
            status: "sent",
            provider_message_id: result.messageId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", messageId);

        // イベントログ
        await supabase.from("events").insert({
          provider: "ses",
          provider_message_id: result.messageId,
          event_type: "send",
          email: message.to_email,
          campaign_id: campaignId,
          occurred_at: new Date().toISOString(),
        });

        console.log(`Email sent successfully: ${messageId}`);
      } else {
        // 失敗
        const newRetryCount = (message.retry_count || 0) + 1;

        if (result.retryable && newRetryCount < 3) {
          // リトライ可能な場合、SQSの自動リトライに任せる
          await supabase
            .from("messages")
            .update({
              status: "queued",
              retry_count: newRetryCount,
              last_error: result.error,
            })
            .eq("id", messageId);

          // バッチ失敗として報告（SQSが再キューする）
          batchItemFailures.push({ itemIdentifier: record.messageId });
          console.error(`Email send failed (retryable): ${messageId}`, result.error);
        } else {
          // リトライ不可または上限に達した場合
          await supabase
            .from("messages")
            .update({
              status: "failed",
              last_error: result.error,
            })
            .eq("id", messageId);

          console.error(`Email send failed (permanent): ${messageId}`, result.error);
        }
      }
    } catch (error) {
      console.error(`Error processing message:`, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // キャンペーンの完了チェック（バッチの最後に1回だけ）
  if (event.Records.length > 0) {
    try {
      const firstMessage: QueueMessage = JSON.parse(event.Records[0].body);
      await checkCampaignCompletion(firstMessage.campaignId);
    } catch (error) {
      console.error("Error checking campaign completion:", error);
    }
  }

  return { batchItemFailures };
}

/**
 * AWS SES でメール送信
 */
async function sendEmailWithSES(
  to: string,
  subject: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<SendResult> {
  try {
    const command = new SendEmailCommand({
      Source: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: text,
            Charset: "UTF-8",
          },
        },
      },
    });

    const response = await sesClient.send(command);
    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable =
      errorMessage.includes("Throttling") ||
      errorMessage.includes("ServiceUnavailable") ||
      errorMessage.includes("InternalFailure");

    return {
      success: false,
      error: errorMessage,
      retryable: isRetryable,
    };
  }
}

/**
 * キャンペーンの完了チェック
 */
async function checkCampaignCompletion(campaignId: string): Promise<void> {
  // 残りのキューメッセージを確認
  const { count: remainingCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["queued", "sending"]);

  if (remainingCount === 0) {
    // 全て処理完了
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .single();

    if (campaign?.status === "sending") {
      await supabase
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      console.log(`Campaign ${campaignId} completed`);
    }
  }
}
