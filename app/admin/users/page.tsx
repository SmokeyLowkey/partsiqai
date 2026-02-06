"use client";

import { useState, useEffect } from "react";
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
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Search,
  Edit,
  Trash2,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Mail,
  Eye,
  EyeOff,
  Send,
  Clock,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  organization: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
  createdAt: Date;
};

type Organization = {
  id: string;
  name: string;
};

type CurrentUser = {
  id: string;
  role: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviter: {
    name: string;
    email: string;
  };
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const { toast } = useToast();

  const isMasterAdmin = currentUser?.role === "MASTER_ADMIN";

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "USER",
    organizationId: "",
    isActive: true,
  });

  // Email integration form state
  const [emailFormData, setEmailFormData] = useState({
    providerType: "GMAIL_OAUTH",
    emailAddress: "",
    isActive: true,
    // OAuth fields
    clientId: "",
    clientSecret: "",
    tenantId: "", // Microsoft specific
    // SMTP fields
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpEncryption: "TLS",
  });

  const [showOAuthSecrets, setShowOAuthSecrets] = useState(false);

  const [existingEmailIntegration, setExistingEmailIntegration] = useState<any>(null);

  // Invitation form state
  const [inviteFormData, setInviteFormData] = useState({
    email: "",
    role: "USER",
    message: "",
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchInvitations();
  }, []);

  // Fetch organizations only for MASTER_ADMIN after currentUser is loaded
  useEffect(() => {
    if (currentUser && isMasterAdmin) {
      fetchOrganizations();
    }
  }, [currentUser, isMasterAdmin]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, roleFilter, statusFilter, orgFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter !== "all") params.append("isActive", statusFilter);
      if (orgFilter !== "all") params.append("organizationId", orgFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      if (!response.ok) throw new Error("Failed to fetch organizations");

      const data = await response.json();
      setOrganizations(data.organizations);
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    }
  };

  const fetchInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const response = await fetch("/api/invitations");
      if (!response.ok) throw new Error("Failed to fetch invitations");

      const data = await response.json();
      setInvitations(data.invitations);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      toast({
        title: "Error",
        description: "Failed to fetch invitations",
        variant: "destructive",
      });
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleSendInvitation = async () => {
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitation");
      }

      toast({
        title: "Success",
        description: "Invitation sent successfully",
      });

      setShowInviteDialog(false);
      setInviteFormData({ email: "", role: "USER", message: "" });
      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;

    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke invitation");

      toast({
        title: "Success",
        description: "Invitation revoked successfully",
      });

      fetchInvitations();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setShowCreateDialog(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setShowEditDialog(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete user");

      toast({
        title: "Success",
        description: "User deactivated successfully",
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update user status");

      toast({
        title: "Success",
        description: `User ${!user.isActive ? "activated" : "deactivated"} successfully`,
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization.id,
      isActive: user.isActive,
    });
    setShowEditDialog(true);
  };

  const openEmailDialog = async (user: User) => {
    setSelectedUser(user);
    setLoadingEmail(true);
    setShowEmailDialog(true);

    // Reset form
    setEmailFormData({
      providerType: "GMAIL_OAUTH",
      emailAddress: user.email,
      isActive: true,
      clientId: "",
      clientSecret: "",
      tenantId: "",
      smtpHost: "",
      smtpPort: "587",
      smtpUsername: "",
      smtpPassword: "",
      smtpEncryption: "TLS",
    });
    setExistingEmailIntegration(null);

    // Fetch existing email integration
    try {
      const response = await fetch(`/api/admin/users/${user.id}/email-integration`);
      if (response.ok) {
        const data = await response.json();
        if (data.emailIntegration) {
          setExistingEmailIntegration(data.emailIntegration);
          setEmailFormData({
            providerType: data.emailIntegration.providerType,
            emailAddress: data.emailIntegration.emailAddress,
            isActive: data.emailIntegration.isActive,
            clientId: "",
            clientSecret: "",
            tenantId: "",
            smtpHost: "",
            smtpPort: "587",
            smtpUsername: "",
            smtpPassword: "",
            smtpEncryption: "TLS",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching email integration:", error);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleSaveEmailIntegration = async () => {
    if (!selectedUser) return;

    try {
      setLoadingEmail(true);

      let credentials: any = {};

      if (emailFormData.providerType === "SMTP") {
        credentials = {
          host: emailFormData.smtpHost,
          port: parseInt(emailFormData.smtpPort),
          username: emailFormData.smtpUsername,
          password: emailFormData.smtpPassword,
          encryption: emailFormData.smtpEncryption,
        };
      } else if (emailFormData.providerType === "GMAIL_OAUTH") {
        credentials = {
          clientId: emailFormData.clientId,
          clientSecret: emailFormData.clientSecret,
        };
      } else if (emailFormData.providerType === "MICROSOFT_OAUTH") {
        credentials = {
          clientId: emailFormData.clientId,
          clientSecret: emailFormData.clientSecret,
          tenantId: emailFormData.tenantId || "common",
        };
      }

      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/email-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerType: emailFormData.providerType,
            emailAddress: emailFormData.emailAddress,
            isActive: emailFormData.isActive,
            credentials,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save email integration");
      }

      // For OAuth providers, redirect to authorization flow
      if (emailFormData.providerType === "GMAIL_OAUTH") {
        toast({
          title: "Credentials Saved",
          description: "Redirecting to Google for authorization...",
        });
        // Redirect to OAuth authorize endpoint with userId
        window.location.href = `/api/integrations/gmail/authorize?userId=${selectedUser.id}`;
        return;
      }

      if (emailFormData.providerType === "MICROSOFT_OAUTH") {
        toast({
          title: "Credentials Saved",
          description: "Redirecting to Microsoft for authorization...",
        });
        window.location.href = `/api/integrations/microsoft/authorize?userId=${selectedUser.id}`;
        return;
      }

      toast({
        title: "Success",
        description: "Email integration configured successfully",
      });

      setShowEmailDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleRemoveEmailIntegration = async () => {
    if (!selectedUser) return;
    if (!confirm("Are you sure you want to remove this email integration?")) return;

    try {
      setLoadingEmail(true);
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/email-integration`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to remove email integration");
      }

      toast({
        title: "Success",
        description: "Email integration removed",
      });

      setShowEmailDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove email integration",
        variant: "destructive",
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "USER",
      // Pre-populate organization for non-master admins
      organizationId: isMasterAdmin ? "" : (currentUser?.organizationId || ""),
      isActive: true,
    });
  };

  const openCreateDialog = () => {
    // Reset form with pre-populated organization for org admins
    setFormData({
      name: "",
      email: "",
      role: "USER",
      organizationId: isMasterAdmin ? "" : (currentUser?.organizationId || ""),
      isActive: true,
    });
    setShowCreateDialog(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "MASTER_ADMIN":
        return "bg-purple-500";
      case "ADMIN":
        return "bg-red-500";
      case "MANAGER":
        return "bg-blue-500";
      case "TECHNICIAN":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            {isMasterAdmin
              ? "Manage users and invitations across all organizations"
              : "Manage users and invitations in your organization"}
          </p>
          {!isMasterAdmin && currentUser && (
            <Badge variant="secondary" className="mt-2">
              {currentUser.organization?.name || "Your Organization"}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={openCreateDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-4 ${isMasterAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {isMasterAdmin && (
                    <SelectItem value="MASTER_ADMIN">Master Admin</SelectItem>
                  )}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isMasterAdmin && (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Users ({users.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.organization.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.organization.subscriptionTier}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleUserStatus(user)}
                        className="h-6 px-2"
                      >
                        {user.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Email config button for non-admin users */}
                        {!["MASTER_ADMIN", "ADMIN"].includes(user.role) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEmailDialog(user)}
                            title="Configure Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowInviteDialog(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send Invitation
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Pending Invitations ({invitations.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchInvitations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvitations ? (
                <div className="text-center py-8">Loading invitations...</div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending invitations
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(invitation.role)}>
                            {invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invitation.status === "PENDING" ? (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          ) : invitation.status === "ACCEPTED" ? (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : invitation.status === "EXPIRED" ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge variant="outline">Revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell>{invitation.inviter.name}</TableCell>
                        <TableCell>
                          {new Date(invitation.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {invitation.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevokeInvitation(invitation.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send Invitation Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Team Invitation</DialogTitle>
            <DialogDescription>
              Invite a new team member to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteFormData.email}
                onChange={(e) =>
                  setInviteFormData({ ...inviteFormData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteFormData.role}
                onValueChange={(value) =>
                  setInviteFormData({ ...inviteFormData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Personal Message (optional)</Label>
              <Textarea
                placeholder="Add a personal message to the invitation..."
                value={inviteFormData.message}
                onChange={(e) =>
                  setInviteFormData({ ...inviteFormData, message: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false);
                setInviteFormData({ email: "", role: "USER", message: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSendInvitation}>
              <Send className="mr-2 h-4 w-4" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. A random password will be generated and sent via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isMasterAdmin && (
                    <SelectItem value="MASTER_ADMIN">Master Admin</SelectItem>
                  )}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Organization</Label>
              {isMasterAdmin ? (
                <Select
                  value={formData.organizationId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, organizationId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={currentUser?.organization?.name || organizations.find(o => o.id === currentUser?.organizationId)?.name || "Your Organization"}
                  disabled
                  className="bg-muted"
                />
              )}
            </div>
            <Alert className="border-blue-200 bg-blue-50">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                A temporary password will be automatically generated and sent to the user's email address.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information (use password reset for password changes)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isMasterAdmin && (
                    <SelectItem value="MASTER_ADMIN">Master Admin</SelectItem>
                  )}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedUser(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Update User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Integration Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Email Integration</DialogTitle>
            <DialogDescription>
              Set up email integration for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          {loadingEmail && !existingEmailIntegration && !emailFormData.providerType ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {existingEmailIntegration && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">Current Configuration</span>
                    {existingEmailIntegration.testStatus === "SUCCESS" ? (
                      <Badge className="bg-green-600">Connected</Badge>
                    ) : existingEmailIntegration.testStatus === "FAILED" ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="secondary">Configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {existingEmailIntegration.providerType.replace("_", " ")} - {existingEmailIntegration.emailAddress}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select
                  value={emailFormData.providerType}
                  onValueChange={(value) =>
                    setEmailFormData({ ...emailFormData, providerType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GMAIL_OAUTH">Gmail (OAuth)</SelectItem>
                    <SelectItem value="MICROSOFT_OAUTH">Microsoft 365 (OAuth)</SelectItem>
                    <SelectItem value="SMTP">Custom SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={emailFormData.emailAddress}
                  onChange={(e) =>
                    setEmailFormData({ ...emailFormData, emailAddress: e.target.value })
                  }
                  placeholder="user@company.com"
                />
              </div>

              {emailFormData.providerType === "SMTP" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        value={emailFormData.smtpHost}
                        onChange={(e) =>
                          setEmailFormData({ ...emailFormData, smtpHost: e.target.value })
                        }
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        value={emailFormData.smtpPort}
                        onChange={(e) =>
                          setEmailFormData({ ...emailFormData, smtpPort: e.target.value })
                        }
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={emailFormData.smtpUsername}
                      onChange={(e) =>
                        setEmailFormData({ ...emailFormData, smtpUsername: e.target.value })
                      }
                      placeholder="username@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSmtpPassword ? "text" : "password"}
                        value={emailFormData.smtpPassword}
                        onChange={(e) =>
                          setEmailFormData({ ...emailFormData, smtpPassword: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      >
                        {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Encryption</Label>
                    <Select
                      value={emailFormData.smtpEncryption}
                      onValueChange={(value) =>
                        setEmailFormData({ ...emailFormData, smtpEncryption: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TLS">TLS (Recommended)</SelectItem>
                        <SelectItem value="SSL">SSL</SelectItem>
                        <SelectItem value="NONE">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {(emailFormData.providerType === "GMAIL_OAUTH" ||
                emailFormData.providerType === "MICROSOFT_OAUTH") && (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input
                        value={emailFormData.clientId}
                        onChange={(e) =>
                          setEmailFormData({ ...emailFormData, clientId: e.target.value })
                        }
                        placeholder={emailFormData.providerType === "GMAIL_OAUTH"
                          ? "xxxxx.apps.googleusercontent.com"
                          : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {emailFormData.providerType === "GMAIL_OAUTH"
                          ? "From Google Cloud Console > APIs & Services > Credentials"
                          : "From Azure Portal > App Registrations > Application (client) ID"
                        }
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showOAuthSecrets ? "text" : "password"}
                          value={emailFormData.clientSecret}
                          onChange={(e) =>
                            setEmailFormData({ ...emailFormData, clientSecret: e.target.value })
                          }
                          placeholder={emailFormData.providerType === "GMAIL_OAUTH"
                            ? "GOCSPX-xxxxxxxx"
                            : "xxxxxxxx~xxxxxxxx"
                          }
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => setShowOAuthSecrets(!showOAuthSecrets)}
                        >
                          {showOAuthSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    {emailFormData.providerType === "MICROSOFT_OAUTH" && (
                      <div className="space-y-2">
                        <Label>Tenant ID (Optional)</Label>
                        <Input
                          value={emailFormData.tenantId}
                          onChange={(e) =>
                            setEmailFormData({ ...emailFormData, tenantId: e.target.value })
                          }
                          placeholder="common (for multi-tenant) or your tenant ID"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave as &quot;common&quot; for multi-tenant apps, or specify your organization&apos;s tenant ID
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mt-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {existingEmailIntegration && existingEmailIntegration.testStatus === "SUCCESS"
                        ? "✓ This account is authorized and ready to use."
                        : `After saving, you will be redirected to ${emailFormData.providerType === "GMAIL_OAUTH" ? "Google" : "Microsoft"} to authorize access to the email account.`}
                    </p>
                  </div>
                  {existingEmailIntegration && existingEmailIntegration.providerType === "GMAIL_OAUTH" && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedUser) {
                            window.location.href = `/api/integrations/gmail/authorize?userId=${selectedUser.id}`;
                          }
                        }}
                        disabled={loadingEmail}
                        className="w-full"
                      >
                        {existingEmailIntegration.testStatus === "SUCCESS" ? "Re-authorize with Google" : "Authorize with Google"}
                      </Button>
                      {existingEmailIntegration.testStatus === "FAILED" && existingEmailIntegration.errorMessage && (
                        <p className="text-xs text-red-500 mt-2">
                          Last error: {existingEmailIntegration.errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                  {existingEmailIntegration && existingEmailIntegration.providerType === "MICROSOFT_OAUTH" && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedUser) {
                            window.location.href = `/api/integrations/microsoft/authorize?userId=${selectedUser.id}`;
                          }
                        }}
                        disabled={loadingEmail}
                        className="w-full"
                      >
                        {existingEmailIntegration.testStatus === "SUCCESS" ? "Re-authorize with Microsoft" : "Authorize with Microsoft"}
                      </Button>
                      {existingEmailIntegration.testStatus === "FAILED" && existingEmailIntegration.errorMessage && (
                        <p className="text-xs text-red-500 mt-2">
                          Last error: {existingEmailIntegration.errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {existingEmailIntegration && (
              <Button
                variant="destructive"
                onClick={handleRemoveEmailIntegration}
                disabled={loadingEmail}
              >
                Remove
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEmailIntegration}
              disabled={
                loadingEmail ||
                !emailFormData.emailAddress ||
                (emailFormData.providerType === "SMTP" &&
                  (!emailFormData.smtpHost || !emailFormData.smtpPassword)) ||
                ((emailFormData.providerType === "GMAIL_OAUTH" ||
                  emailFormData.providerType === "MICROSOFT_OAUTH") &&
                  (!emailFormData.clientId || !emailFormData.clientSecret) &&
                  !existingEmailIntegration)
              }
            >
              {loadingEmail ? "Saving..." : existingEmailIntegration ? "Update & Authorize" : "Save & Authorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
