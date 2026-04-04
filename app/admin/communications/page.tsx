"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  Eye,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquareReply,
  Reply,
} from "lucide-react";

type Organization = {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
};

type OrgUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type AdminEmailRecord = {
  id: string;
  subject: string;
  htmlBody: string;
  templateType: string | null;
  senderEmail: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  sentBy: { id: string; name: string | null; email: string } | null;
  recipient: { id: string; name: string | null; email: string } | null;
  organization: { id: string; name: string } | null;
  _count?: { replies: number };
};

type EmailReply = {
  id: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  sentBy: { id: string; name: string | null; email: string } | null;
};

const TEMPLATE_OPTIONS = [
  { value: "welcome_followup", label: "Welcome Follow-up" },
  { value: "trial_expiring", label: "Trial Expiring" },
  { value: "setup_help", label: "Setup Help" },
  { value: "custom", label: "Custom Email" },
];

const SENDER_OPTIONS = [
  { value: "onboarding@partsiqai.com", label: "onboarding@partsiqai.com" },
  { value: "support@partsiqai.com", label: "support@partsiqai.com" },
  { value: "sales@partsiqai.com", label: "sales@partsiqai.com" },
];

const DEFAULT_SUBJECTS: Record<string, string> = {
  welcome_followup: "Welcome to PartsIQ!",
  trial_expiring: "Your PartsIQ trial is ending soon",
  setup_help: "Need help setting up PartsIQ?",
};

export default function CommunicationsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground py-8 text-center">Loading...</div>}>
      <CommunicationsContent />
    </Suspense>
  );
}

function CommunicationsContent() {
  const searchParams = useSearchParams();
  const preselectedOrgId = searchParams.get("organizationId");
  const { toast } = useToast();

  // Compose state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(preselectedOrgId || "");
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState("");
  const [senderEmail, setSenderEmail] = useState("onboarding@partsiqai.com");
  const [subject, setSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Preview state
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Replies state
  const [showReplies, setShowReplies] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [repliesEmailSubject, setRepliesEmailSubject] = useState("");
  const [repliesEmailId, setRepliesEmailId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replySenderEmail, setReplySenderEmail] = useState("support@partsiqai.com");
  const [replySending, setReplySending] = useState(false);

  // History state
  const [emails, setEmails] = useState<AdminEmailRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyOrgFilter, setHistoryOrgFilter] = useState("");
  const [historyTemplateFilter, setHistoryTemplateFilter] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Fetch history on mount and filter changes
  useEffect(() => {
    fetchHistory();
  }, [historyPage, historyOrgFilter, historyTemplateFilter]);

  // Debounced search for history
  useEffect(() => {
    const timeout = setTimeout(() => {
      setHistoryPage(1);
      fetchHistory();
    }, 300);
    return () => clearTimeout(timeout);
  }, [historySearch]);

  // Fetch users when org changes
  useEffect(() => {
    if (selectedOrgId) {
      fetchOrgUsers(selectedOrgId);
    } else {
      setOrgUsers([]);
      setSelectedUserIds([]);
    }
  }, [selectedOrgId]);

  // Auto-fill subject when template changes
  useEffect(() => {
    if (templateType && templateType !== "custom") {
      setSubject(DEFAULT_SUBJECTS[templateType] || "");
    }
  }, [templateType]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (!res.ok) return;
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch {
      // silent
    }
  };

  const fetchOrgUsers = async (orgId: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?organizationId=${orgId}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrgUsers(data.users || []);
      setSelectedUserIds([]);
    } catch {
      // silent
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(historyPage));
      params.set("limit", "15");
      if (historyOrgFilter) params.set("organizationId", historyOrgFilter);
      if (historyTemplateFilter) params.set("templateType", historyTemplateFilter);
      if (historySearch) params.set("search", historySearch);

      const res = await fetch(`/api/admin/communications/history?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setEmails(data.emails || []);
      setHistoryTotal(data.pagination?.total || 0);
      setHistoryTotalPages(data.pagination?.totalPages || 0);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyOrgFilter, historyTemplateFilter, historySearch]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.length === orgUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(orgUsers.map((u) => u.id));
    }
  };

  const handleSend = async () => {
    if (!selectedOrgId || selectedUserIds.length === 0 || !templateType) {
      toast({ title: "Missing fields", description: "Select an organization, recipients, and template.", variant: "destructive" });
      return;
    }
    if (templateType === "custom" && (!subject || !customBody)) {
      toast({ title: "Missing fields", description: "Subject and body are required for custom emails.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType,
          organizationId: selectedOrgId,
          recipientUserIds: selectedUserIds,
          senderEmail,
          subject: subject || undefined,
          customBody: customBody || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }

      toast({
        title: "Emails sent",
        description: `${data.sent} sent, ${data.failed} failed`,
      });

      // Reset form
      setSelectedUserIds([]);
      setTemplateType("");
      setSubject("");
      setCustomBody("");

      // Refresh history
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const viewEmailHtml = (html: string) => {
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const viewReplies = async (emailId: string, subject: string) => {
    setRepliesEmailId(emailId);
    setRepliesEmailSubject(subject);
    setReplies([]);
    setReplyBody("");
    setShowReplies(true);
    setRepliesLoading(true);
    try {
      const res = await fetch(`/api/admin/communications/${emailId}/replies`);
      if (!res.ok) throw new Error("Failed to fetch replies");
      const data = await res.json();
      setReplies(data.replies || []);
    } catch {
      toast({ title: "Error", description: "Failed to load replies", variant: "destructive" });
    } finally {
      setRepliesLoading(false);
    }
  };

  const sendReply = async () => {
    if (!replyBody.trim() || !repliesEmailId) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/admin/communications/${repliesEmailId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, senderEmail: replySenderEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      setReplies((prev) => [...prev, data.reply]);
      setReplyBody("");
      toast({ title: "Reply sent", description: "Your reply has been sent successfully." });
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReplySending(false);
    }
  };

  const isFormValid =
    selectedOrgId &&
    selectedUserIds.length > 0 &&
    templateType &&
    (templateType !== "custom" || (subject && customBody));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Communications</h1>
        <p className="text-muted-foreground">
          Send emails to organization users and view communication history
        </p>
      </div>

      {/* Compose Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </CardTitle>
          <CardDescription>
            Send templated or custom emails to organization users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Organization Picker */}
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.subscriptionStatus})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sender Email */}
            <div className="space-y-2">
              <Label>From Address</Label>
              <Select value={senderEmail} onValueChange={setSenderEmail}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* User Picker */}
          {selectedOrgId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                {orgUsers.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAllUsers}>
                    {selectedUserIds.length === orgUsers.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>
              {loadingUsers ? (
                <div className="text-sm text-muted-foreground py-2">Loading users...</div>
              ) : orgUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">No users found in this organization</div>
              ) : (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {orgUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded p-1.5 -mx-1.5"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user.name || user.email.split("@")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {user.role}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedUserIds.length} recipient{selectedUserIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          {/* Template Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject (editable for all, required for custom) */}
            <div className="space-y-2">
              <Label>Subject {templateType !== "custom" && "(optional override)"}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={templateType === "custom" ? "Email subject..." : DEFAULT_SUBJECTS[templateType] || "Auto-generated from template"}
              />
            </div>
          </div>

          {/* Custom body (only for custom template) */}
          {templateType === "custom" && (
            <div className="space-y-2">
              <Label>Email Body</Label>
              <Textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="Write your email message here..."
                rows={6}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSend} disabled={!isFormValid || sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email{selectedUserIds.length > 1 ? `s (${selectedUserIds.length})` : ""}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Email History</CardTitle>
              <CardDescription>{historyTotal} email{historyTotal !== 1 ? "s" : ""} sent</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchHistory()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject or recipient..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={historyOrgFilter} onValueChange={(v) => { setHistoryOrgFilter(v === "all" ? "" : v); setHistoryPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={historyTemplateFilter} onValueChange={(v) => { setHistoryTemplateFilter(v === "all" ? "" : v); setHistoryPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                {TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No emails found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Replies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(email.createdAt).toLocaleDateString()}{" "}
                      <span className="text-muted-foreground">
                        {new Date(email.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{email.senderEmail.split("@")[0]}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{email.recipientName || email.recipientEmail}</div>
                        {email.recipientName && (
                          <div className="text-xs text-muted-foreground">{email.recipientEmail}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{email.organization?.name || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{email.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TEMPLATE_OPTIONS.find((t) => t.value === email.templateType)?.label || email.templateType || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {email.status === "sent" ? (
                        <Badge className="bg-green-500 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <XCircle className="h-3 w-3" /> Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(email._count?.replies ?? 0) > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-blue-600 hover:text-blue-700"
                          onClick={() => viewReplies(email.id, email.subject)}
                        >
                          <MessageSquareReply className="h-3.5 w-3.5" />
                          {email._count!.replies}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewEmailHtml(email.htmlBody)}
                          title="Preview email"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(email._count?.replies ?? 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewReplies(email.id, email.subject)}
                            title="View replies"
                          >
                            <Reply className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {historyPage} of {historyTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HTML Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Rendered HTML email content</DialogDescription>
          </DialogHeader>
          <div
            className="border rounded-md p-4 bg-white text-black"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>

      {/* Replies Dialog */}
      <Dialog open={showReplies} onOpenChange={setShowReplies}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareReply className="h-5 w-5" />
              Conversation
            </DialogTitle>
            <DialogDescription>
              Thread: {repliesEmailSubject}
            </DialogDescription>
          </DialogHeader>

          {/* Message thread */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {repliesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No replies yet</div>
            ) : (
              replies.map((reply) => {
                const isOutbound = reply.direction === "OUTBOUND";
                return (
                  <div
                    key={reply.id}
                    className={`rounded-lg p-4 space-y-2 ${
                      isOutbound
                        ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 ml-8"
                        : "bg-muted/50 border mr-8"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {isOutbound ? (
                          <>
                            <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300">
                              Sent
                            </Badge>
                            {reply.sentBy?.name || reply.fromEmail}
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-xs">
                              Received
                            </Badge>
                            {reply.fromName ? `${reply.fromName} <${reply.fromEmail}>` : reply.fromEmail}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(reply.receivedAt).toLocaleDateString()}{" "}
                        {new Date(reply.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {isOutbound && reply.toEmail && (
                      <div className="text-xs text-muted-foreground">To: {reply.toEmail}</div>
                    )}
                    {reply.bodyHtml ? (
                      <div
                        className="border rounded-md p-3 bg-white text-black text-sm"
                        dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                      />
                    ) : (
                      <pre className="border rounded-md p-3 bg-muted text-sm whitespace-pre-wrap">
                        {reply.bodyText || "(No content)"}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Reply compose */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">From:</Label>
              <Select value={replySenderEmail} onValueChange={setReplySenderEmail}>
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={sendReply}
                disabled={!replyBody.trim() || replySending}
                size="sm"
              >
                {replySending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
