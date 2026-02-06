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
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  RefreshCw,
  PiggyBank,
  Calendar,
  ArrowLeft,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

type CostSavingsData = {
  totalSavings: number;
  totalManualCost: number;
  totalPlatformCost: number;
  overallSavingsPercent: number;
  totalOrdersProcessed: number;
  avgOrderValue: number;
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

export default function CustomerCostSavingsPage() {
  const [data, setData] = useState<CostSavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState("12");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [months]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cost-savings?months=${months}`);

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
          <Link href="/customer/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Your Cost Savings</h1>
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
          <Link href="/customer/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Your Cost Savings</h1>
            <p className="text-muted-foreground">
              Track how much you&apos;ve saved compared to OEM prices
            </p>
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

      {data.totalOrdersProcessed === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <PiggyBank className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Cost Savings Data Yet</h3>
            <p className="text-muted-foreground mb-4">
              Cost savings are calculated when you place orders through the platform.
              <br />
              Savings are based on the difference between OEM/List prices and your actual order cost.
            </p>
            <Link href="/customer/quote-requests">
              <Button>
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Quote Requests
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                <PiggyBank className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${data.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                {previousMonth && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    {savingsGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {savingsGrowth.toFixed(1)}% vs previous month
                  </p>
                )}
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
                  Below OEM/List prices
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
                  What it would have cost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Actual Cost</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${data.totalPlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.totalOrdersProcessed} orders tracked
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Savings Breakdown */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    Your savings summary
                  </p>
                  <p className="text-4xl font-bold text-green-800 dark:text-green-200 mt-1">
                    ${data.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    saved on {data.totalOrdersProcessed} orders
                  </p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">
                      ${data.avgOrderValue.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Order</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      ${(data.totalSavings / data.totalOrdersProcessed).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Savings/Order</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Savings Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Savings History
              </CardTitle>
              <CardDescription>Your cost savings over time</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedMonthly.length > 0 ? (
                <div className="space-y-4">
                  {sortedMonthly.slice(0, 12).reverse().map((month, index) => {
                    const maxSavings = Math.max(...sortedMonthly.map(m => m.totalSavings));
                    const barWidth = maxSavings > 0 ? (month.totalSavings / maxSavings) * 100 : 0;
                    const prevMonth = sortedMonthly.slice(0, 12).reverse()[index - 1];
                    const monthGrowth = prevMonth && prevMonth.totalSavings > 0
                      ? ((month.totalSavings - prevMonth.totalSavings) / prevMonth.totalSavings * 100)
                      : 0;

                    return (
                      <div key={`${month.year}-${month.month}`} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {monthNames[month.month - 1]} {month.year}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {month.ordersProcessed} orders
                            </span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              ${month.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            {index > 0 && monthGrowth !== 0 && (
                              <Badge
                                variant={monthGrowth >= 0 ? "default" : "secondary"}
                                className={monthGrowth >= 0 ? "bg-green-600" : ""}
                              >
                                {monthGrowth >= 0 ? "+" : ""}{monthGrowth.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            OEM: ${(month.totalSavings / (month.savingsPercent / 100) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span>{month.savingsPercent.toFixed(1)}% savings rate</span>
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
        </>
      )}
    </div>
  );
}
