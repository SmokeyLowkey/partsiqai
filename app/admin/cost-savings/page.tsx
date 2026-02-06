"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  RefreshCw,
  PiggyBank,
  Building2,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

type CostSavingsData = {
  totalSavings: number;
  totalManualCost: number;
  totalPlatformCost: number;
  overallSavingsPercent: number;
  totalOrdersProcessed: number;
  avgOrderValue: number;
  savingsByOrganization?: Array<{
    organizationId: string;
    organizationName: string;
    totalSavings: number;
    savingsPercent: number;
    ordersProcessed: number;
  }>;
  monthlySavings: Array<{
    month: number;
    year: number;
    totalSavings: number;
    savingsPercent: number;
    ordersProcessed: number;
  }>;
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CostSavingsPage() {
  const [data, setData] = useState<CostSavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState("12");
  const [isMasterAdmin, setIsMasterAdmin] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [months]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // First try to fetch all organizations (master admin)
      let response = await fetch(`/api/cost-savings?all=true&months=${months}`);

      if (response.status === 403) {
        // Not a master admin, fetch org-level data
        setIsMasterAdmin(false);
        response = await fetch(`/api/cost-savings?months=${months}`);
      } else {
        setIsMasterAdmin(true);
      }

      if (!response.ok) throw new Error("Failed to fetch cost savings");

      const result = await response.json();
      setData(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cost savings data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/analytics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Cost Savings Analytics</h1>
        </div>
        <div className="text-center py-12">Loading cost savings data...</div>
      </div>
    );
  }

  // Calculate month-over-month growth
  const sortedMonthly = [...data.monthlySavings].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const currentMonth = sortedMonthly[0];
  const previousMonth = sortedMonthly[1];
  const savingsGrowth = previousMonth && previousMonth.totalSavings > 0
    ? ((currentMonth?.totalSavings || 0) - previousMonth.totalSavings) / previousMonth.totalSavings * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/admin/analytics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Cost Savings Analytics</h1>
            <p className="text-muted-foreground">
              {isMasterAdmin
                ? "Detailed cost savings across all organizations"
                : "Your organization's cost savings details"}
            </p>
            {!isMasterAdmin && (
              <Badge variant="secondary" className="mt-2">Organization View</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost Savings</CardTitle>
            <PiggyBank className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              ${data.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              {savingsGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {savingsGrowth.toFixed(1)}% vs previous month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overallSavingsPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average discount from OEM prices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OEM Cost (Avoided)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.totalManualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total OEM/List price value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.totalPlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totalOrdersProcessed} orders • ${data.avgOrderValue.toFixed(0)} avg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Savings Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Savings Trend
            </CardTitle>
            <CardDescription>Cost savings over time</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedMonthly.length > 0 ? (
              <div className="space-y-3">
                {sortedMonthly.slice(0, 12).reverse().map((month) => {
                  const maxSavings = Math.max(...sortedMonthly.map(m => m.totalSavings));
                  const barWidth = maxSavings > 0 ? (month.totalSavings / maxSavings) * 100 : 0;

                  return (
                    <div key={`${month.year}-${month.month}`} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {monthNames[month.month - 1]} {month.year}
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          ${month.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 dark:bg-green-600 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{month.ordersProcessed} orders</span>
                        <span>{month.savingsPercent.toFixed(1)}% saved</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No monthly data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Organizations - Only for Master Admin */}
        {isMasterAdmin && data.savingsByOrganization ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Top Organizations by Savings
              </CardTitle>
              <CardDescription>Highest cost savings by organization</CardDescription>
            </CardHeader>
            <CardContent>
              {data.savingsByOrganization.length > 0 ? (
                <div className="space-y-3">
                  {data.savingsByOrganization.slice(0, 10).map((org, index) => {
                    const maxSavings = data.savingsByOrganization![0]?.totalSavings || 1;
                    const barWidth = (org.totalSavings / maxSavings) * 100;

                    return (
                      <div key={org.organizationId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                            {org.organizationName}
                          </span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            ${org.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 dark:bg-green-600 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{org.ordersProcessed} orders</span>
                          <span>{org.savingsPercent.toFixed(1)}% rate</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No organization data available</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Savings Summary
              </CardTitle>
              <CardDescription>Your organization's savings breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="font-medium">{data.totalOrdersProcessed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Order Value</span>
                  <span className="font-medium">${data.avgOrderValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Savings/Order</span>
                  <span className="font-medium text-green-600">
                    ${data.totalOrdersProcessed > 0
                      ? (data.totalSavings / data.totalOrdersProcessed).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Saved</span>
                    <span className="text-lg font-bold text-green-600">
                      ${data.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Table - Only for Master Admin */}
      {isMasterAdmin && data.savingsByOrganization && (
        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>Complete cost savings breakdown by organization</CardDescription>
          </CardHeader>
          <CardContent>
            {data.savingsByOrganization.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Total Savings</TableHead>
                    <TableHead className="text-right">Savings Rate</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Avg Savings/Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.savingsByOrganization.map((org) => (
                    <TableRow key={org.organizationId}>
                      <TableCell className="font-medium">{org.organizationName}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                        ${org.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={org.savingsPercent >= 20 ? "default" : "secondary"}
                          className={org.savingsPercent >= 20 ? "bg-green-600" : ""}
                        >
                          {org.savingsPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {org.ordersProcessed}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${org.ordersProcessed > 0
                          ? (org.totalSavings / org.ordersProcessed).toFixed(0)
                          : '0'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No cost savings data available yet</p>
                <p className="text-sm mt-1">Cost savings will appear after orders with OEM prices are processed</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state for org-level admins with no data */}
      {!isMasterAdmin && data.totalOrdersProcessed === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No cost savings data available yet</p>
              <p className="text-sm mt-1">Cost savings will appear after orders with OEM prices are processed</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
