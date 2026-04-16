"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Trash2, RefreshCw, AlertTriangle, Shield, ShieldAlert, ShieldOff } from "lucide-react";

interface PoolNumber {
  id: string;
  vapiPhoneNumberId: string;
  e164: string;
  areaCode: string | null;
  provider: string;
  isActive: boolean;
  healthStatus: "HEALTHY" | "DEGRADED" | "BLOCKED" | "RETIRED";
  vapiStatus: string | null;
  blockedReason: string | null;
  blockedAt: string | null;
  dailyCallCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  _count: { supplierCalls: number };
}

interface PoolSummary {
  healthy: number;
  degraded: number;
  blocked: number;
  retired: number;
  total: number;
}

const healthBadge = (status: string) => {
  switch (status) {
    case "HEALTHY":
      return <Badge variant="default" className="bg-green-600"><Shield className="h-3 w-3 mr-1" />Healthy</Badge>;
    case "DEGRADED":
      return <Badge variant="secondary" className="bg-yellow-600 text-white"><ShieldAlert className="h-3 w-3 mr-1" />Degraded</Badge>;
    case "BLOCKED":
      return <Badge variant="destructive"><ShieldOff className="h-3 w-3 mr-1" />Blocked</Badge>;
    case "RETIRED":
      return <Badge variant="outline">Retired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function PhonePoolPanel() {
  const [numbers, setNumbers] = useState<PoolNumber[]>([]);
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [poolAlert, setPoolAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newAreaCode, setNewAreaCode] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/phone-pool");
      if (res.ok) {
        const data = await res.json();
        setNumbers(data.numbers);
        setSummary(data.summary);
        setPoolAlert(data.alert);
      }
    } catch (error) {
      console.error("Failed to fetch phone pool:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const res = await fetch("/api/admin/phone-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision", areaCode: newAreaCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewAreaCode("");
      await fetchPool();
    } catch (error: any) {
      alert(`Provision failed: ${error.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handleAction = async (phoneNumberId: string, action: "release" | "block") => {
    if (action === "release" && !confirm("Release this number? This will remove it from Vapi and Twilio (stops billing).")) {
      return;
    }
    setActionInProgress(phoneNumberId);
    try {
      const res = await fetch("/api/admin/phone-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, phoneNumberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchPool();
    } catch (error: any) {
      alert(`Action failed: ${error.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/phone-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Synced ${data.updated} numbers (${data.failed} failed)`);
      await fetchPool();
    } catch (error: any) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading phone pool...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Phone Number Pool
        </CardTitle>
        <CardDescription>
          Manage the pool of phone numbers used for outbound supplier calls. Numbers are rotated automatically with health tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert banner */}
        {poolAlert && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{poolAlert}</span>
          </div>
        )}

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.healthy}</div>
              <div className="text-xs text-muted-foreground">Healthy</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.degraded}</div>
              <div className="text-xs text-muted-foreground">Degraded</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{summary.blocked}</div>
              <div className="text-xs text-muted-foreground">Blocked</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{summary.retired}</div>
              <div className="text-xs text-muted-foreground">Retired</div>
            </div>
          </div>
        )}

        {/* Provision new number */}
        <div className="flex items-center gap-2">
          <Input
            value={newAreaCode}
            onChange={(e) => setNewAreaCode(e.target.value)}
            placeholder="Area code (optional, e.g. 832)"
            className="max-w-[200px]"
            maxLength={3}
          />
          <Button onClick={handleProvision} disabled={provisioning}>
            {provisioning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Provision New Number
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync All Numbers
          </Button>
        </div>

        {/* Numbers table */}
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Number</th>
                  <th className="text-left p-3 font-medium">Area</th>
                  <th className="text-left p-3 font-medium">Health</th>
                  <th className="text-center p-3 font-medium">Today</th>
                  <th className="text-center p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Last Used</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {numbers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No phone numbers in pool. Provision your first number above.
                    </td>
                  </tr>
                ) : (
                  numbers.map((num) => (
                    <tr key={num.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-sm">{num.e164}</td>
                      <td className="p-3 text-sm">{num.areaCode || "—"}</td>
                      <td className="p-3">{healthBadge(num.healthStatus)}</td>
                      <td className="p-3 text-center text-sm">{num.dailyCallCount}</td>
                      <td className="p-3 text-center text-sm">{num._count.supplierCalls}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {num.lastUsedAt
                          ? new Date(num.lastUsedAt).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {num.isActive && num.healthStatus !== "BLOCKED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(num.id, "block")}
                              disabled={actionInProgress === num.id}
                              title="Mark as blocked"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(num.id, "release")}
                            disabled={actionInProgress === num.id}
                            title="Release number"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Blocked reason tooltip */}
        {numbers.some((n) => n.blockedReason) && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Blocked numbers:</p>
            {numbers
              .filter((n) => n.blockedReason)
              .map((n) => (
                <p key={n.id} className="text-xs text-muted-foreground">
                  {n.e164}: {n.blockedReason}
                  {n.blockedAt && ` (${new Date(n.blockedAt).toLocaleDateString()})`}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
