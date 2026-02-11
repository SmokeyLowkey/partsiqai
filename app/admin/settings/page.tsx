"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  RefreshCw,
  Plus,
  Edit,
  Database,
  Shield,
  Bell,
  Palette,
  ShieldAlert,
  Building2,
  Save,
  Lock,
  Clock,
  Mail,
  Globe,
  Plug,
  Brain,
  Zap,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileSearch,
} from "lucide-react";

type SystemSetting = {
  id: string;
  key: string;
  value: string;
  category: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrganizationSettings = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  primaryColor: string | null;
  passwordPolicy: any;
  sessionTimeoutMinutes: number;
  requireTwoFactor: boolean;
  allowedEmailDomains: string[];
  settings: any;
  maxUsers: number;
  maxVehicles: number;
  subscriptionTier: string;
  subscriptionStatus: string;
};

type Integration = {
  id?: string;
  integrationType: string;
  name: string;
  isActive: boolean;
  lastTestedAt?: string;
  testStatus?: "SUCCESS" | "FAILED" | "PENDING";
  errorMessage?: string;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Role detection
  const isMasterAdmin = session?.user?.role === "MASTER_ADMIN";
  const isAdmin = session?.user?.role === "ADMIN" || isMasterAdmin;

  // Organization settings state
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [orgFormData, setOrgFormData] = useState({
    name: "",
    primaryColor: "#2563eb",
    sessionTimeoutMinutes: 60,
    requireTwoFactor: false,
    allowedEmailDomains: "",
  });

  // System settings state (Master Admin only)
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    value: "",
    category: "",
    description: "",
  });

  // Integration settings state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [savingIntegration, setSavingIntegration] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  const [openRouterConfig, setOpenRouterConfig] = useState({
    apiKey: "",
    defaultModel: "anthropic/claude-3.5-sonnet",
  });

  const [pineconeConfig, setPineconeConfig] = useState({
    apiKey: "",
    host: "",
  });

  const [neo4jConfig, setNeo4jConfig] = useState({
    uri: "",
    username: "neo4j",
    password: "",
    database: "neo4j",
  });

  const [mistralConfig, setMistralConfig] = useState({
    apiKey: "",
  });

  // Platform-wide Vapi configuration state (Master Admin only)
  const [vapiPlatformConfig, setVapiPlatformConfig] = useState({
    apiKey: "",
    phoneNumberId: "",
  });
  const [savingVapi, setSavingVapi] = useState(false);
  const [testingVapi, setTestingVapi] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      fetchOrgSettings();
      fetchIntegrations();
      if (isMasterAdmin) {
        fetchSystemSettings();
        fetchVapiPlatformSettings();
      }
    }
  }, [status, isAdmin, isMasterAdmin]);

  const fetchOrgSettings = async () => {
    try {
      const response = await fetch("/api/admin/organization-settings");
      if (response.ok) {
        const data = await response.json();
        setOrgSettings(data.organization);
        setOrgFormData({
          name: data.organization.name || "",
          primaryColor: data.organization.primaryColor || "#2563eb",
          sessionTimeoutMinutes: data.organization.sessionTimeoutMinutes || 60,
          requireTwoFactor: data.organization.requireTwoFactor || false,
          allowedEmailDomains: (data.organization.allowedEmailDomains || []).join(", "),
        });
      }
    } catch (error) {
      console.error("Error fetching org settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSystemSettings(data.settings || []);
      }
    } catch (error) {
      console.error("Error fetching system settings:", error);
    }
  };

  const fetchVapiPlatformSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        const settings = data.settings || [];
        
        const vapiApiKey = settings.find((s: SystemSetting) => s.key === "VAPI_PLATFORM_API_KEY");
        const vapiPhoneId = settings.find((s: SystemSetting) => s.key === "VAPI_PLATFORM_PHONE_NUMBER_ID");
        
        setVapiPlatformConfig({
          apiKey: vapiApiKey?.value || "",
          phoneNumberId: vapiPhoneId?.value || "",
        });
      }
    } catch (error) {
      console.error("Error fetching Vapi platform settings:", error);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    }
  };

  const handleSaveOrgSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/organization-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgFormData.name,
          primaryColor: orgFormData.primaryColor,
          sessionTimeoutMinutes: orgFormData.sessionTimeoutMinutes,
          requireTwoFactor: orgFormData.requireTwoFactor,
          allowedEmailDomains: orgFormData.allowedEmailDomains
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      toast({
        title: "Success",
        description: "Organization settings saved successfully",
      });
      fetchOrgSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSystemSetting = async () => {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save setting");
      }

      toast({
        title: "Success",
        description: "System setting saved successfully",
      });

      setShowDialog(false);
      setEditingSetting(null);
      resetSystemForm();
      fetchSystemSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveIntegration = async (type: string) => {
    try {
      setSavingIntegration(type);

      let credentials: any = {};
      let config: any = {};

      switch (type) {
        case "OPENROUTER":
          credentials = { apiKey: openRouterConfig.apiKey };
          config = { defaultModel: openRouterConfig.defaultModel };
          break;
        case "PINECONE":
          credentials = { apiKey: pineconeConfig.apiKey, host: pineconeConfig.host };
          break;
        case "NEO4J":
          credentials = {
            uri: neo4jConfig.uri,
            username: neo4jConfig.username,
            password: neo4jConfig.password,
            database: neo4jConfig.database,
          };
          break;
        case "MISTRAL":
          credentials = { apiKey: mistralConfig.apiKey };
          break;
      }

      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationType: type,
          credentials,
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save integration");
      }

      const result = await response.json();

      toast({
        title: result.testResult ? "Integration Saved & Connected" : "Integration Saved",
        description: result.testResult
          ? "Credentials saved and connection verified successfully"
          : "Credentials saved but connection test failed",
        variant: result.testResult ? "default" : "destructive",
      });

      fetchIntegrations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingIntegration(null);
    }
  };

  const handleTestIntegration = async (type: string) => {
    try {
      setTestingIntegration(type);

      const response = await fetch(`/api/integrations/${type}/test`, {
        method: "POST",
      });

      const result = await response.json();

      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.success
          ? "Integration is working correctly"
          : result.error || "Failed to connect",
        variant: result.success ? "default" : "destructive",
      });

      fetchIntegrations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingIntegration(null);
    }
  };

  const handleSaveVapiPlatform = async () => {
    try {
      setSavingVapi(true);

      // Save API Key
      if (vapiPlatformConfig.apiKey) {
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "VAPI_PLATFORM_API_KEY",
            value: vapiPlatformConfig.apiKey,
            category: "API",
            description: "Platform-wide Vapi API Key (used when organizations don't provide their own)",
          }),
        });
      }

      // Save Phone Number ID
      if (vapiPlatformConfig.phoneNumberId) {
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "VAPI_PLATFORM_PHONE_NUMBER_ID",
            value: vapiPlatformConfig.phoneNumberId,
            category: "API",
            description: "Platform-wide Vapi Phone Number ID (used when organizations don't provide their own)",
          }),
        });
      }

      toast({
        title: "Success",
        description: "Platform Vapi settings saved successfully",
      });

      fetchVapiPlatformSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVapi(false);
    }
  };

  const handleTestVapiPlatform = async () => {
    try {
      setTestingVapi(true);

      // Simple validation test
      if (!vapiPlatformConfig.apiKey || !vapiPlatformConfig.phoneNumberId) {
        throw new Error("Both API Key and Phone Number ID are required");
      }

      toast({
        title: "Validation Successful",
        description: "Vapi platform settings are configured. Test during actual call initiation.",
      });
    } catch (error: any) {
      toast({
        title: "Validation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingVapi(false);
    }
  };

  const toggleShowApiKey = (key: string) => {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getIntegrationStatus = (type: string) => {
    return integrations.find((i) => i.integrationType === type);
  };

  const getStatusBadge = (integration?: Integration) => {
    if (!integration) {
      return <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>;
    }
    switch (integration.testStatus) {
      case "SUCCESS":
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">Configured</Badge>;
    }
  };

  const openEditDialog = (setting: SystemSetting) => {
    setEditingSetting(setting);
    setFormData({
      key: setting.key,
      value: setting.value,
      category: setting.category || "",
      description: setting.description || "",
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingSetting(null);
    resetSystemForm();
    setShowDialog(true);
  };

  const resetSystemForm = () => {
    setFormData({
      key: "",
      value: "",
      category: "",
      description: "",
    });
  };

  const getCategoryIcon = (category: string | null) => {
    switch (category) {
      case "DATABASE":
        return <Database className="h-4 w-4" />;
      case "SECURITY":
        return <Shield className="h-4 w-4" />;
      case "NOTIFICATIONS":
        return <Bell className="h-4 w-4" />;
      case "UI":
        return <Palette className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const groupedSettings = systemSettings.reduce((acc, setting) => {
    const category = setting.category || "General";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-50 dark:bg-red-950 rounded-full p-6 mb-6">
          <ShieldAlert className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          You do not have permission to access settings.
          This feature is only available to Administrators.
        </p>
        <Badge variant="destructive" className="mb-4">Admin Access Required</Badge>
        <a href="/admin/analytics">
          <Button variant="outline">Return to Dashboard</Button>
        </a>
      </div>
    );
  }

  // Organization Settings Content
  const OrganizationSettingsContent = () => (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Basic organization information and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={orgFormData.name}
                onChange={(e) =>
                  setOrgFormData({ ...orgFormData, name: e.target.value })
                }
                placeholder="Your Organization"
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={orgFormData.primaryColor}
                  onChange={(e) =>
                    setOrgFormData({ ...orgFormData, primaryColor: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={orgFormData.primaryColor}
                  onChange={(e) =>
                    setOrgFormData({ ...orgFormData, primaryColor: e.target.value })
                  }
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          {orgSettings && (
            <div className="flex gap-2 pt-2">
              <Badge variant="outline">{orgSettings.subscriptionTier}</Badge>
              <Badge variant="secondary">{orgSettings.subscriptionStatus}</Badge>
              <Badge variant="outline">
                {orgSettings.maxUsers} users max
              </Badge>
              <Badge variant="outline">
                {orgSettings.maxVehicles} vehicles max
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Configure authentication and security policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require all users to set up 2FA
              </p>
            </div>
            <Switch
              checked={orgFormData.requireTwoFactor}
              onCheckedChange={(checked) =>
                setOrgFormData({ ...orgFormData, requireTwoFactor: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Timeout (minutes)
            </Label>
            <Select
              value={String(orgFormData.sessionTimeoutMinutes)}
              onValueChange={(value) =>
                setOrgFormData({
                  ...orgFormData,
                  sessionTimeoutMinutes: parseInt(value),
                })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="480">8 hours</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Allowed Email Domains
            </Label>
            <Input
              value={orgFormData.allowedEmailDomains}
              onChange={(e) =>
                setOrgFormData({
                  ...orgFormData,
                  allowedEmailDomains: e.target.value,
                })
              }
              placeholder="company.com, partner.com"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of allowed email domains for new users. Leave empty to allow all.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveOrgSettings} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Organization Settings
        </Button>
      </div>
    </div>
  );

  // Integrations Content
  const IntegrationsContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            API Integrations
          </CardTitle>
          <CardDescription>
            Configure third-party services for AI-powered search and data management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OpenRouter Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">OpenRouter</h3>
                  <p className="text-sm text-muted-foreground">LLM API for AI-powered search and chat</p>
                </div>
              </div>
              {getStatusBadge(getIntegrationStatus("OPENROUTER"))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys["openrouter"] ? "text" : "password"}
                    value={openRouterConfig.apiKey}
                    onChange={(e) => setOpenRouterConfig({ ...openRouterConfig, apiKey: e.target.value })}
                    placeholder="sk-or-xxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("openrouter")}
                  >
                    {showApiKeys["openrouter"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Select
                  value={openRouterConfig.defaultModel}
                  onValueChange={(value) => setOpenRouterConfig({ ...openRouterConfig, defaultModel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="anthropic/claude-3-opus">Claude 3 Opus</SelectItem>
                    <SelectItem value="openai/gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="openai/gpt-4.1">GPT-4.1</SelectItem>
                    <SelectItem value="google/gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pl-12">
              <Button
                onClick={() => handleSaveIntegration("OPENROUTER")}
                disabled={savingIntegration === "OPENROUTER" || !openRouterConfig.apiKey}
              >
                {savingIntegration === "OPENROUTER" ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              {getIntegrationStatus("OPENROUTER") && (
                <Button
                  variant="outline"
                  onClick={() => handleTestIntegration("OPENROUTER")}
                  disabled={testingIntegration === "OPENROUTER"}
                >
                  {testingIntegration === "OPENROUTER" ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Pinecone Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium">Pinecone</h3>
                  <p className="text-sm text-muted-foreground">Vector database for semantic part search</p>
                </div>
              </div>
              {getStatusBadge(getIntegrationStatus("PINECONE"))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys["pinecone"] ? "text" : "password"}
                    value={pineconeConfig.apiKey}
                    onChange={(e) => setPineconeConfig({ ...pineconeConfig, apiKey: e.target.value })}
                    placeholder="pcsk_xxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("pinecone")}
                  >
                    {showApiKeys["pinecone"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Host URL</Label>
                <Input
                  value={pineconeConfig.host}
                  onChange={(e) => setPineconeConfig({ ...pineconeConfig, host: e.target.value })}
                  placeholder="https://your-index.svc.environment.pinecone.io"
                />
              </div>
            </div>

            <div className="flex gap-2 pl-12">
              <Button
                onClick={() => handleSaveIntegration("PINECONE")}
                disabled={savingIntegration === "PINECONE" || !pineconeConfig.apiKey || !pineconeConfig.host}
              >
                {savingIntegration === "PINECONE" ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              {getIntegrationStatus("PINECONE") && (
                <Button
                  variant="outline"
                  onClick={() => handleTestIntegration("PINECONE")}
                  disabled={testingIntegration === "PINECONE"}
                >
                  {testingIntegration === "PINECONE" ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Neo4j Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium">Neo4j</h3>
                  <p className="text-sm text-muted-foreground">Graph database for part compatibility search</p>
                </div>
              </div>
              {getStatusBadge(getIntegrationStatus("NEO4J"))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              <div className="space-y-2">
                <Label>Connection URI</Label>
                <Input
                  value={neo4jConfig.uri}
                  onChange={(e) => setNeo4jConfig({ ...neo4jConfig, uri: e.target.value })}
                  placeholder="neo4j+s://xxx.databases.neo4j.io"
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={neo4jConfig.username}
                  onChange={(e) => setNeo4jConfig({ ...neo4jConfig, username: e.target.value })}
                  placeholder="neo4j"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys["neo4j"] ? "text" : "password"}
                    value={neo4jConfig.password}
                    onChange={(e) => setNeo4jConfig({ ...neo4jConfig, password: e.target.value })}
                    placeholder="Enter password"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("neo4j")}
                  >
                    {showApiKeys["neo4j"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Database</Label>
                <Input
                  value={neo4jConfig.database}
                  onChange={(e) => setNeo4jConfig({ ...neo4jConfig, database: e.target.value })}
                  placeholder="neo4j"
                />
              </div>
            </div>

            <div className="flex gap-2 pl-12">
              <Button
                onClick={() => handleSaveIntegration("NEO4J")}
                disabled={savingIntegration === "NEO4J" || !neo4jConfig.uri || !neo4jConfig.password}
              >
                {savingIntegration === "NEO4J" ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              {getIntegrationStatus("NEO4J") && (
                <Button
                  variant="outline"
                  onClick={() => handleTestIntegration("NEO4J")}
                  disabled={testingIntegration === "NEO4J"}
                >
                  {testingIntegration === "NEO4J" ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Mistral Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <FileSearch className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium">Mistral AI</h3>
                  <p className="text-sm text-muted-foreground">PDF OCR extraction for maintenance manuals</p>
                </div>
              </div>
              {getStatusBadge(getIntegrationStatus("MISTRAL"))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys["mistral"] ? "text" : "password"}
                    value={mistralConfig.apiKey}
                    onChange={(e) => setMistralConfig({ ...mistralConfig, apiKey: e.target.value })}
                    placeholder="Enter Mistral API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("mistral")}
                  >
                    {showApiKeys["mistral"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pl-12">
              <Button
                onClick={() => handleSaveIntegration("MISTRAL")}
                disabled={savingIntegration === "MISTRAL" || !mistralConfig.apiKey}
              >
                {savingIntegration === "MISTRAL" ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              {getIntegrationStatus("MISTRAL") && (
                <Button
                  variant="outline"
                  onClick={() => handleTestIntegration("MISTRAL")}
                  disabled={testingIntegration === "MISTRAL"}
                >
                  {testingIntegration === "MISTRAL" ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info about email integration */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Email Integration</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Email integration is configured per-user. Go to the Users page and click the email icon
                next to a user to configure their email settings (Gmail OAuth, Microsoft OAuth, or SMTP).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // System Settings Content (Master Admin only)
  const SystemSettingsContent = () => (
    <div className="space-y-6">
      {/* Platform-wide Vapi Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Platform VoIP Configuration (Vapi)
          </CardTitle>
          <CardDescription>
            Configure platform-wide Vapi settings. Organizations will use these credentials when they haven't provided their own (BYOK disabled).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">Vapi.ai Platform Keys</h3>
                <p className="text-sm text-muted-foreground">
                  Default API credentials for AI-powered phone calls
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
              <div className="space-y-2">
                <Label>Platform API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys["vapi"] ? "text" : "password"}
                    value={vapiPlatformConfig.apiKey}
                    onChange={(e) => setVapiPlatformConfig({ ...vapiPlatformConfig, apiKey: e.target.value })}
                    placeholder="231d8537-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("vapi")}
                  >
                    {showApiKeys["vapi"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  From Vapi.ai dashboard → API Keys
                </p>
              </div>
              <div className="space-y-2">
                <Label>Platform Phone Number ID</Label>
                <Input
                  value={vapiPlatformConfig.phoneNumberId}
                  onChange={(e) => setVapiPlatformConfig({ ...vapiPlatformConfig, phoneNumberId: e.target.value })}
                  placeholder="aebd364e-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                {vapiPlatformConfig.phoneNumberId && (
                  <p className="text-xs text-muted-foreground">
                    🎯 Active phone number configured
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pl-12">
              <Button
                onClick={handleSaveVapiPlatform}
                disabled={savingVapi || (!vapiPlatformConfig.apiKey && !vapiPlatformConfig.phoneNumberId)}
              >
                {savingVapi ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Platform Keys
              </Button>
              {vapiPlatformConfig.apiKey && vapiPlatformConfig.phoneNumberId && (
                <Button
                  variant="outline"
                  onClick={handleTestVapiPlatform}
                  disabled={testingVapi}
                >
                  {testingVapi ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Validate Configuration
                </Button>
              )}
            </div>

            <div className="pl-12 mt-4 p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex gap-2 text-sm">
                <div className="text-muted-foreground">
                  <strong>Note:</strong> Organizations with BYOK (Bring Your Own Keys) enabled will use their own Vapi credentials instead of these platform keys. This ensures organizations maintain control over their API usage and billing.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-200">App-Wide Configuration</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                These settings apply to all organizations in the platform. Organizations with BYOK enabled will use their own credentials instead.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            {isMasterAdmin
              ? "Manage organization, integrations, and system-wide settings"
              : "Manage your organization settings and integrations"}
          </p>
          {!isMasterAdmin && (
            <Badge variant="secondary" className="mt-2">Organization Admin</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          {isMasterAdmin && (
            <TabsTrigger value="system" className="gap-2">
              <Globe className="h-4 w-4" />
              System (App-Wide)
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="organization">
          <OrganizationSettingsContent />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsContent />
        </TabsContent>

        {isMasterAdmin && (
          <TabsContent value="system">
            <SystemSettingsContent />
          </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit System Setting Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSetting ? "Edit Setting" : "Create New Setting"}
            </DialogTitle>
            <DialogDescription>
              {editingSetting
                ? "Update the system setting"
                : "Add a new system-wide configuration setting"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                placeholder="e.g., max_upload_size"
                disabled={!!editingSetting}
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea
                value={formData.value}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value })
                }
                placeholder="Enter setting value"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="DATABASE">Database</SelectItem>
                  <SelectItem value="SECURITY">Security</SelectItem>
                  <SelectItem value="NOTIFICATIONS">Notifications</SelectItem>
                  <SelectItem value="UI">User Interface</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this setting controls"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setEditingSetting(null);
                resetSystemForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSystemSetting}>
              {editingSetting ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
