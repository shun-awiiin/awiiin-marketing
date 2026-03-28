"use client";

import React from "react";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Users,
  Settings,
  Send,
  CheckCircle,
  Calendar,
  Eye,
  Sparkles,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
  SUBJECT_VARIANTS,
  Template,
  Tag,
} from "@/lib/types/database";
import type { Segment } from "@/lib/types/l-step";
import {
  renderTemplate,
  generateSubject,
  buildContext,
} from "@/lib/email/template-renderer";

interface SegmentOption {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
}

interface ListOption {
  id: string;
  name: string;
  description: string | null;
  color: string;
  contact_count: number;
}

interface CampaignWizardProps {
  templates: Template[];
  tags: Tag[];
  segments: SegmentOption[];
  lists: ListOption[];
  totalActiveContacts: number;
  userId: string;
}

type Step = "type" | "content" | "audience" | "schedule" | "review";

const steps: { id: Step; title: string; icon: React.ElementType }[] = [
  { id: "type", title: "テンプレート", icon: FileText },
  { id: "content", title: "内容入力", icon: Settings },
  { id: "audience", title: "宛先", icon: Users },
  { id: "schedule", title: "スケジュール", icon: Calendar },
  { id: "review", title: "確認", icon: CheckCircle },
];

const templateTypeInfo: Record<
  TemplateType,
  { label: string; description: string; icon: React.ElementType }
> = {
  SEMINAR_INVITE: {
    label: "セミナー・イベント案内",
    description: "ウェビナー、勉強会、説明会などの招待メール",
    icon: Calendar,
  },
  FREE_TRIAL_INVITE: {
    label: "無料登録・トライアル案内",
    description: "β募集、無料トライアル、新サービス案内など",
    icon: Sparkles,
  },
};

export function CampaignWizard({
  templates,
  tags,
  segments,
  lists,
  totalActiveContacts,
  userId,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>("type");
  const [campaignData, setCampaignData] = useState({
    name: "",
    type: "" as TemplateType | "",
    templateId: "",
    subjectIndex: 0,
    audienceType: "all" as "all" | "tags" | "segment" | "list" | "specific",
    selectedTags: [] as string[],
    selectedSegmentId: "" as string,
    selectedListId: "" as string,
    specificEmails: "" as string, // comma or newline separated
    scheduleType: "now" as "now" | "later",
    scheduledAt: "",
    // Seminar invite fields
    eventName: "",
    eventDate: "",
    eventLocation: "",
    eventUrl: "",
    // Free trial fields
    toolName: "",
    oneLiner: "",
    trialUrl: "",
    // Shared
    extraBullets: ["", "", ""],
  });
  const [loading, setLoading] = useState(false);
  const [audienceCount, setAudienceCount] = useState(totalActiveContacts);
  const [showPreview, setShowPreview] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [userSettings, setUserSettings] = useState<{
    sendFromName: string;
    sendFromEmail: string;
  }>({ sendFromName: "", sendFromEmail: "" });
  const router = useRouter();
  const supabase = createClient();

  // Fetch user settings for from_name and from_email defaults
  useEffect(() => {
    const fetchUserSettings = async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("settings")
        .eq("id", userId)
        .single();

      if (userData?.settings) {
        setUserSettings({
          sendFromName: userData.settings.sendFromName || "",
          sendFromEmail: userData.settings.sendFromEmail || "",
        });
      }
    };
    fetchUserSettings();
  }, [supabase, userId]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Filter templates by selected type
  const filteredTemplates = useMemo(() => {
    if (!campaignData.type) return [];
    return templates.filter((t) => t.type === campaignData.type);
  }, [templates, campaignData.type]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === campaignData.templateId),
    [templates, campaignData.templateId]
  );

  // Auto-select first template when type changes
  useEffect(() => {
    if (campaignData.type && filteredTemplates.length > 0 && !campaignData.templateId) {
      setCampaignData((prev) => ({
        ...prev,
        templateId: filteredTemplates[0].id,
      }));
    }
  }, [campaignData.type, filteredTemplates, campaignData.templateId]);

  // Fetch audience count when tags/emails/segment change
  useEffect(() => {
    const fetchAudienceCount = async () => {
      if (campaignData.audienceType === "all") {
        setAudienceCount(totalActiveContacts);
      } else if (campaignData.audienceType === "specific") {
        // Count specific emails
        const emails = campaignData.specificEmails
          .split(/[,\n]/)
          .map((e) => e.trim())
          .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        setAudienceCount(emails.length);
      } else if (campaignData.audienceType === "list" && campaignData.selectedListId) {
        const list = lists.find(l => l.id === campaignData.selectedListId);
        setAudienceCount(list?.contact_count ?? 0);
      } else if (campaignData.audienceType === "segment" && campaignData.selectedSegmentId) {
        // Get segment contact count
        const segment = segments.find(s => s.id === campaignData.selectedSegmentId);
        setAudienceCount(segment?.contact_count ?? 0);
      } else if (campaignData.audienceType === "tags" && campaignData.selectedTags.length > 0) {
        const { count } = await supabase
          .from("contact_tags")
          .select("contact_id", { count: "exact", head: true })
          .in("tag_id", campaignData.selectedTags);
        setAudienceCount(count ?? 0);
      } else {
        setAudienceCount(0);
      }
    };
    fetchAudienceCount();
  }, [campaignData.audienceType, campaignData.selectedTags, campaignData.selectedSegmentId, campaignData.selectedListId, campaignData.specificEmails, totalActiveContacts, supabase, segments, lists]);

  // Generate preview content
  const preview = useMemo(() => {
    if (!selectedTemplate || !campaignData.type) return null;

    const payload =
      campaignData.type === "SEMINAR_INVITE"
        ? ({
            event_name: campaignData.eventName || "[イベント名]",
            event_date: campaignData.eventDate || "[開催日時]",
            event_location: campaignData.eventLocation || "[開催場所]",
            url: campaignData.eventUrl || "https://example.com",
            extra_bullets: campaignData.extraBullets.filter((b) => b.trim()),
          } as SeminarInvitePayload)
        : ({
            tool_name: campaignData.toolName || "[ツール名]",
            one_liner: campaignData.oneLiner || "[一言説明]",
            url: campaignData.trialUrl || "https://example.com",
            extra_bullets: campaignData.extraBullets.filter((b) => b.trim()),
          } as FreeTrialInvitePayload);

    const context = buildContext(campaignData.type, payload, "山田");
    const subject = generateSubject(campaignData.type, campaignData.subjectIndex, "山田");
    const body = renderTemplate(selectedTemplate.body_text, context);

    return { subject, body };
  }, [selectedTemplate, campaignData]);

  // Validation
  const canProceed = () => {
    switch (currentStep) {
      case "type":
        return campaignData.type !== "" && campaignData.templateId !== "";
      case "content":
        if (campaignData.type === "SEMINAR_INVITE") {
          return (
            campaignData.name !== "" &&
            campaignData.eventName !== "" &&
            campaignData.eventDate !== "" &&
            campaignData.eventLocation !== "" &&
            campaignData.eventUrl !== ""
          );
        } else if (campaignData.type === "FREE_TRIAL_INVITE") {
          return (
            campaignData.name !== "" &&
            campaignData.toolName !== "" &&
            campaignData.oneLiner !== "" &&
            campaignData.trialUrl !== ""
          );
        }
        return false;
      case "audience":
        if (campaignData.audienceType === "all") return true;
        if (campaignData.audienceType === "list") return campaignData.selectedListId !== "";
        if (campaignData.audienceType === "segment") return campaignData.selectedSegmentId !== "";
        if (campaignData.audienceType === "tags") return campaignData.selectedTags.length > 0;
        if (campaignData.audienceType === "specific") {
          // Check if at least one valid email is entered
          const emails = campaignData.specificEmails
            .split(/[,\n]/)
            .map((e) => e.trim())
            .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
          return emails.length > 0;
        }
        return false;
      case "schedule":
        return (
          campaignData.scheduleType === "now" ||
          (campaignData.scheduleType === "later" && campaignData.scheduledAt !== "")
        );
      default:
        return true;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleCreate = async () => {
    if (!campaignData.type || !selectedTemplate) return;
    setLoading(true);

    const payload =
      campaignData.type === "SEMINAR_INVITE"
        ? {
            event_name: campaignData.eventName,
            event_date: campaignData.eventDate,
            event_location: campaignData.eventLocation,
            url: campaignData.eventUrl,
            extra_bullets: campaignData.extraBullets.filter((b) => b.trim()),
          }
        : {
            tool_name: campaignData.toolName,
            one_liner: campaignData.oneLiner,
            url: campaignData.trialUrl,
            extra_bullets: campaignData.extraBullets.filter((b) => b.trim()),
          };

    // Validate sender settings
    if (!userSettings.sendFromName || !userSettings.sendFromEmail) {
      alert("送信者設定が未設定です。設定画面で「送信者名」と「送信元メールアドレス」を設定してください。");
      setLoading(false);
      return;
    }

    const context = buildContext(campaignData.type, payload as SeminarInvitePayload | FreeTrialInvitePayload, null);
    const subjectTemplate = SUBJECT_VARIANTS[campaignData.type][campaignData.subjectIndex];
    const bodyRendered = renderTemplate(selectedTemplate.body_text, context);

    // Parse specific emails if provided
    const specificEmailsList = campaignData.audienceType === "specific"
      ? campaignData.specificEmails
          .split(/[,\n]/)
          .map((e) => e.trim())
          .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      : null;

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: userId,
        name: campaignData.name,
        template_id: campaignData.templateId,
        type: campaignData.type,
        input_payload: payload,
        subject_override: subjectTemplate,
        body_override: bodyRendered,
        variables: {},
        filter_tags:
          campaignData.audienceType === "tags" ? campaignData.selectedTags : null,
        segment_id:
          campaignData.audienceType === "segment" ? campaignData.selectedSegmentId : null,
        list_id:
          campaignData.audienceType === "list" ? campaignData.selectedListId : null,
        specific_emails: specificEmailsList,
        from_name: userSettings.sendFromName,
        from_email: userSettings.sendFromEmail,
        rate_limit_per_minute: 20,
        status: campaignData.scheduleType === "now" ? "scheduled" : "draft",
        scheduled_at:
          campaignData.scheduleType === "later"
            ? new Date(campaignData.scheduledAt).toISOString()
            : new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Campaign creation error:", error);
      alert(`キャンペーン作成エラー: ${error.message}`);
      setLoading(false);
      return;
    }

    if (campaign) {
      // キャンペーン一覧ページにリダイレクト（詳細ページの404問題を回避）
      router.push(`/dashboard/campaigns`);
    }
    setLoading(false);
  };

  const toggleTag = (tagId: string) => {
    setCampaignData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter((id) => id !== tagId)
        : [...prev.selectedTags, tagId],
    }));
  };

  const updateExtraBullet = (index: number, value: string) => {
    const newBullets = [...campaignData.extraBullets];
    newBullets[index] = value;
    setCampaignData((prev) => ({ ...prev, extraBullets: newBullets }));
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">新規キャンペーン</h1>
          <p className="text-muted-foreground">
            ステップに沿ってキャンペーンを作成
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-1 ${
                index <= currentStepIndex
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <step.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStepIndex].title}</CardTitle>
              <CardDescription>
                {currentStep === "type" && "メールの種類とテンプレートを選択してください"}
                {currentStep === "content" && "メールの内容を入力してください"}
                {currentStep === "audience" && "メールを送信する宛先を選択してください"}
                {currentStep === "schedule" && "送信タイミングを設定してください"}
                {currentStep === "review" && "設定内容を確認してください"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: Template Type Selection */}
              {currentStep === "type" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <Label className="text-base font-medium mb-3 block">
                      メールの種類
                    </Label>
                    <RadioGroup
                      value={campaignData.type}
                      onValueChange={(value) =>
                        setCampaignData({
                          ...campaignData,
                          type: value as TemplateType,
                          templateId: "",
                        })
                      }
                      className="flex flex-col gap-3"
                    >
                      {(Object.keys(templateTypeInfo) as TemplateType[]).map(
                        (type) => {
                          const info = templateTypeInfo[type];
                          return (
                            <div
                              key={type}
                              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                                campaignData.type === type
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() =>
                                setCampaignData({
                                  ...campaignData,
                                  type,
                                  templateId: "",
                                })
                              }
                            >
                              <RadioGroupItem value={type} id={type} />
                              <info.icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div>
                                <label
                                  htmlFor={type}
                                  className="font-medium cursor-pointer"
                                >
                                  {info.label}
                                </label>
                                <p className="text-sm text-muted-foreground">
                                  {info.description}
                                </p>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </RadioGroup>
                  </div>

                  {campaignData.type && filteredTemplates.length > 0 && (
                    <div>
                      <Label className="text-base font-medium mb-3 block">
                        テンプレートを選択
                      </Label>
                      <RadioGroup
                        value={campaignData.templateId}
                        onValueChange={(value) =>
                          setCampaignData({ ...campaignData, templateId: value })
                        }
                        className="flex flex-col gap-3"
                      >
                        {filteredTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              campaignData.templateId === template.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() =>
                              setCampaignData({
                                ...campaignData,
                                templateId: template.id,
                              })
                            }
                          >
                            <RadioGroupItem value={template.id} id={template.id} />
                            <div className="flex-1">
                              <label
                                htmlFor={template.id}
                                className="font-medium cursor-pointer"
                              >
                                {template.name}
                              </label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {template.category}
                              </p>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Content Input */}
              {currentStep === "content" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">キャンペーン名 *</Label>
                    <Input
                      id="name"
                      placeholder="例: 2月セミナー案内"
                      value={campaignData.name}
                      onChange={(e) =>
                        setCampaignData({ ...campaignData, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="subject">件名パターン *</Label>
                    <Select
                      value={campaignData.subjectIndex.toString()}
                      onValueChange={(value) =>
                        setCampaignData({
                          ...campaignData,
                          subjectIndex: parseInt(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="件名を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignData.type &&
                          SUBJECT_VARIANTS[campaignData.type].map((subject, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {subject.replace("{{firstName}}", "山田")}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {campaignData.type === "SEMINAR_INVITE" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="eventName">イベント名 *</Label>
                        <Input
                          id="eventName"
                          placeholder="例: 第3回 AIマーケティング勉強会"
                          value={campaignData.eventName}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              eventName: e.target.value,
                            })
                          }
                          maxLength={60}
                        />
                        <p className="text-xs text-muted-foreground">
                          {campaignData.eventName.length}/60文字
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="eventDate">開催日時 *</Label>
                        <Input
                          id="eventDate"
                          placeholder="例: 2026年2月15日（土）14:00〜15:30"
                          value={campaignData.eventDate}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              eventDate: e.target.value,
                            })
                          }
                          maxLength={30}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="eventLocation">開催場所 *</Label>
                        <Input
                          id="eventLocation"
                          placeholder="例: Zoomオンライン"
                          value={campaignData.eventLocation}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              eventLocation: e.target.value,
                            })
                          }
                          maxLength={40}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="eventUrl">申込URL *</Label>
                        <Input
                          id="eventUrl"
                          type="url"
                          placeholder="https://example.com/register"
                          value={campaignData.eventUrl}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              eventUrl: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {campaignData.type === "FREE_TRIAL_INVITE" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="toolName">ツール・サービス名 *</Label>
                        <Input
                          id="toolName"
                          placeholder="例: AIライティングアシスタント"
                          value={campaignData.toolName}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              toolName: e.target.value,
                            })
                          }
                          maxLength={30}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="oneLiner">一言説明 *</Label>
                        <Textarea
                          id="oneLiner"
                          placeholder="例: 記事作成を3倍速にするAIツールです"
                          value={campaignData.oneLiner}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              oneLiner: e.target.value,
                            })
                          }
                          maxLength={120}
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          {campaignData.oneLiner.length}/120文字
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="trialUrl">登録URL *</Label>
                        <Input
                          id="trialUrl"
                          type="url"
                          placeholder="https://example.com/signup"
                          value={campaignData.trialUrl}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              trialUrl: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label>追加ポイント（任意、最大3つ）</Label>
                    {[0, 1, 2].map((index) => (
                      <Input
                        key={index}
                        placeholder={`追加ポイント ${index + 1}`}
                        value={campaignData.extraBullets[index]}
                        onChange={(e) => updateExtraBullet(index, e.target.value)}
                        maxLength={80}
                      />
                    ))}
                    <p className="text-xs text-muted-foreground">
                      メール本文に箇条書きで追加されます
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Audience Selection */}
              {currentStep === "audience" && (
                <div className="flex flex-col gap-4">
                  <RadioGroup
                    value={campaignData.audienceType}
                    onValueChange={(value: "all" | "tags" | "segment" | "list" | "specific") =>
                      setCampaignData({ ...campaignData, audienceType: value })
                    }
                    className="flex flex-col gap-3"
                  >
                    <div
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        campaignData.audienceType === "all"
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() =>
                        setCampaignData({ ...campaignData, audienceType: "all" })
                      }
                    >
                      <RadioGroupItem value="all" id="all" />
                      <div>
                        <label htmlFor="all" className="font-medium cursor-pointer">
                          全ての有効な連絡先
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {totalActiveContacts}件の連絡先に送信
                        </p>
                      </div>
                    </div>
                    {lists.length > 0 && (
                      <div
                        className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          campaignData.audienceType === "list"
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setCampaignData({ ...campaignData, audienceType: "list" })
                        }
                      >
                        <RadioGroupItem value="list" id="list" />
                        <div>
                          <label htmlFor="list" className="font-medium cursor-pointer">
                            リストから選択
                          </label>
                          <p className="text-sm text-muted-foreground">
                            静的リストに登録された連絡先に送信
                          </p>
                        </div>
                      </div>
                    )}
                    {segments.length > 0 && (
                      <div
                        className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          campaignData.audienceType === "segment"
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setCampaignData({ ...campaignData, audienceType: "segment" })
                        }
                      >
                        <RadioGroupItem value="segment" id="segment" />
                        <div>
                          <label htmlFor="segment" className="font-medium cursor-pointer">
                            セグメントで絞り込み
                          </label>
                          <p className="text-sm text-muted-foreground">
                            条件に基づいた動的なグループに送信
                          </p>
                        </div>
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        campaignData.audienceType === "tags"
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() =>
                        setCampaignData({ ...campaignData, audienceType: "tags" })
                      }
                    >
                      <RadioGroupItem value="tags" id="tags" />
                      <div>
                        <label htmlFor="tags" className="font-medium cursor-pointer">
                          タグで絞り込み
                        </label>
                        <p className="text-sm text-muted-foreground">
                          特定のタグが付いた連絡先のみに送信
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        campaignData.audienceType === "specific"
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() =>
                        setCampaignData({ ...campaignData, audienceType: "specific" })
                      }
                    >
                      <RadioGroupItem value="specific" id="specific" />
                      <div>
                        <label htmlFor="specific" className="font-medium cursor-pointer">
                          特定のメールアドレスに送信
                        </label>
                        <p className="text-sm text-muted-foreground">
                          メールアドレスを直接入力して送信
                        </p>
                      </div>
                    </div>
                  </RadioGroup>

                  {campaignData.audienceType === "list" && (
                    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg">
                      <Label>リストを選択</Label>
                      <Select
                        value={campaignData.selectedListId}
                        onValueChange={(value) =>
                          setCampaignData({ ...campaignData, selectedListId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="リストを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {lists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block w-3 h-3 rounded-full"
                                  style={{ backgroundColor: list.color }}
                                />
                                <span>{list.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({list.contact_count}件)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {campaignData.selectedListId && (
                        <p className="text-xs text-muted-foreground">
                          {lists.find(l => l.id === campaignData.selectedListId)?.description}
                        </p>
                      )}
                    </div>
                  )}

                  {campaignData.audienceType === "segment" && (
                    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg">
                      <Label>セグメントを選択</Label>
                      <Select
                        value={campaignData.selectedSegmentId}
                        onValueChange={(value) =>
                          setCampaignData({ ...campaignData, selectedSegmentId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="セグメントを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {segments.map((segment) => (
                            <SelectItem key={segment.id} value={segment.id}>
                              <div className="flex items-center gap-2">
                                <span>{segment.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({segment.contact_count}件)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {campaignData.selectedSegmentId && (
                        <p className="text-xs text-muted-foreground">
                          {segments.find(s => s.id === campaignData.selectedSegmentId)?.description}
                        </p>
                      )}
                    </div>
                  )}

                  {campaignData.audienceType === "tags" && (
                    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg">
                      <Label>タグを選択</Label>
                      {tags.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          タグがまだ作成されていません
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <div
                              key={tag.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                                campaignData.selectedTags.includes(tag.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/80"
                              }`}
                              onClick={() => toggleTag(tag.id)}
                            >
                              <Checkbox
                                checked={campaignData.selectedTags.includes(tag.id)}
                                className="pointer-events-none"
                              />
                              <span className="text-sm">{tag.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {campaignData.audienceType === "specific" && (
                    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg">
                      <Label>メールアドレスを入力</Label>
                      <Textarea
                        placeholder="test@example.com&#10;user@example.com&#10;（カンマまたは改行で区切り）"
                        value={campaignData.specificEmails}
                        onChange={(e) =>
                          setCampaignData({
                            ...campaignData,
                            specificEmails: e.target.value,
                          })
                        }
                        rows={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        複数のメールアドレスはカンマまたは改行で区切ってください
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      送信対象: {audienceCount}件
                      {campaignData.audienceType === "specific" ? "のメールアドレス" : "の連絡先"}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Schedule */}
              {currentStep === "schedule" && (
                <RadioGroup
                  value={campaignData.scheduleType}
                  onValueChange={(value: "now" | "later") =>
                    setCampaignData({ ...campaignData, scheduleType: value })
                  }
                  className="flex flex-col gap-3"
                >
                  <div
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      campaignData.scheduleType === "now"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      setCampaignData({ ...campaignData, scheduleType: "now" })
                    }
                  >
                    <RadioGroupItem value="now" id="now" />
                    <div>
                      <label htmlFor="now" className="font-medium cursor-pointer">
                        今すぐ送信
                      </label>
                      <p className="text-sm text-muted-foreground">
                        キャンペーン作成後、すぐに送信を開始します
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      campaignData.scheduleType === "later"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      setCampaignData({ ...campaignData, scheduleType: "later" })
                    }
                  >
                    <RadioGroupItem value="later" id="later" />
                    <div className="flex-1">
                      <label htmlFor="later" className="font-medium cursor-pointer">
                        日時を指定
                      </label>
                      <p className="text-sm text-muted-foreground mb-2">
                        指定した日時に送信を開始します
                      </p>
                      {campaignData.scheduleType === "later" && (
                        <Input
                          type="datetime-local"
                          value={campaignData.scheduledAt}
                          onChange={(e) =>
                            setCampaignData({
                              ...campaignData,
                              scheduledAt: e.target.value,
                            })
                          }
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      )}
                    </div>
                  </div>
                </RadioGroup>
              )}

              {/* Step 5: Review */}
              {currentStep === "review" && (
                <div className="flex flex-col gap-4">
                  {/* Warning if sender settings not configured */}
                  {(!userSettings.sendFromName || !userSettings.sendFromEmail) && (
                    <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
                      <p className="text-red-700 font-medium">送信者設定が必要です</p>
                      <p className="text-sm text-red-600 mt-1">
                        設定画面で「送信者名」と「送信元メールアドレス」を設定してください。
                        設定されていないとキャンペーンを作成できません。
                      </p>
                      <a
                        href="/dashboard/settings"
                        className="inline-block mt-2 text-sm text-red-700 underline"
                      >
                        設定画面を開く
                      </a>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">キャンペーン名</p>
                      <p className="font-medium">{campaignData.name}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">メールタイプ</p>
                      <p className="font-medium">
                        {campaignData.type && templateTypeInfo[campaignData.type]?.label}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">送信対象</p>
                      <p className="font-medium">{audienceCount}件の連絡先</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {campaignData.audienceType === "all" && "全ての有効な連絡先"}
                        {campaignData.audienceType === "list" &&
                          `リスト: ${lists.find(l => l.id === campaignData.selectedListId)?.name ?? ""}`}
                        {campaignData.audienceType === "segment" &&
                          `セグメント: ${segments.find(s => s.id === campaignData.selectedSegmentId)?.name ?? ""}`}
                        {campaignData.audienceType === "tags" &&
                          `タグ: ${campaignData.selectedTags.length}件選択`}
                        {campaignData.audienceType === "specific" && "指定メールアドレス"}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">スケジュール</p>
                      <p className="font-medium">
                        {campaignData.scheduleType === "now"
                          ? "今すぐ送信"
                          : new Date(campaignData.scheduledAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg col-span-2">
                      <p className="text-sm text-muted-foreground">送信者情報</p>
                      <p className="font-medium">
                        {userSettings.sendFromName || "(未設定)"} &lt;{userSettings.sendFromEmail || "(未設定)"}&gt;
                      </p>
                    </div>
                  </div>
                  {preview && (
                    <>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">件名</p>
                        <p className="font-medium">{preview.subject}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">本文プレビュー</p>
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {preview.body.slice(0, 500)}
                          {preview.body.length > 500 && "..."}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="hidden lg:block">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                プレビュー
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">件名</p>
                    <p className="text-sm font-medium">{preview.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">本文</p>
                    <pre className="text-xs whitespace-pre-wrap font-sans bg-muted p-3 rounded-lg max-h-64 overflow-auto">
                      {preview.body}
                    </pre>
                  </div>
                  
                  {/* Test Send Section */}
                  <div className="border-t pt-3 mt-2">
                    <p className="text-xs font-medium mb-2">テスト送信</p>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={testSending || !testEmail || !userSettings.sendFromEmail}
                        onClick={async () => {
                          setTestSending(true);
                          setTestResult(null);
                          try {
                            const res = await fetch('/api/email/test', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                to: testEmail,
                                subject: preview.subject,
                                body: preview.body,
                                fromName: userSettings.sendFromName,
                                fromEmail: userSettings.sendFromEmail,
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setTestResult({ success: true, message: '送信しました' });
                            } else {
                              setTestResult({ success: false, message: data.error });
                            }
                          } catch {
                            setTestResult({ success: false, message: 'エラーが発生しました' });
                          }
                          setTestSending(false);
                        }}
                      >
                        {testSending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {testResult && (
                      <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {testResult.message}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {testResult.message}
                          </span>
                        )}
                      </p>
                    )}
                    {!userSettings.sendFromEmail && (
                      <p className="text-xs text-yellow-600 mt-1">
                        送信者設定が必要です
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    テンプレートを選択するとプレビューが表示されます
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Preview Toggle */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="mr-2 h-4 w-4" />
          {showPreview ? "プレビューを閉じる" : "プレビューを表示"}
        </Button>
        {showPreview && preview && (
          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">件名</p>
                  <p className="text-sm font-medium">{preview.subject}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">本文</p>
                  <pre className="text-xs whitespace-pre-wrap font-sans bg-muted p-3 rounded-lg max-h-64 overflow-auto">
                    {preview.body}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        {currentStep === "review" ? (
          <Button
            onClick={handleCreate}
            disabled={loading || !userSettings.sendFromName || !userSettings.sendFromEmail}
          >
            <Send className="mr-2 h-4 w-4" />
            {loading ? "作成中..." : "キャンペーンを作成"}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            次へ
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
