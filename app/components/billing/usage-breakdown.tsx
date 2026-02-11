"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, ChevronLeft, ChevronRight, Download, Eye, Zap, Search, Layout, FileText, ImageIcon, User, ArrowUpRight, TrendingUp, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { UsageType } from "@/lib/db/types";
import { getFeaturePricing } from "@/lib/constants/job-credits";

interface UsageEvent {
  id: string;
  jobId: string;
  jobTitle: string;
  userName: string;
  userEmail: string;
  credits: number;
  jobType: UsageType | null;
  isOverage: boolean;
  status: 'pending' | 'processed' | 'failed';
  createdAt: string;
  billingPeriodStart: string | null;
}

interface UsageBreakdownProps {
  organizationId: string;
}

export function UsageBreakdown({ organizationId }: UsageBreakdownProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [jobTypeFilter, setJobTypeFilter] = useState<UsageType | "all">("all");
  const [isOverageFilter, setIsOverageFilter] = useState<boolean | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchEvents = async (page: number = 1) => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (jobTypeFilter !== "all") params.append("jobType", jobTypeFilter);
      if (isOverageFilter !== "all") params.append("isOverage", isOverageFilter.toString());
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/usage/breakdown?${params}`, {
        headers: { 'Authorization': `Bearer ${user.email}` }
      });

      if (!response.ok) {
        if (response.status === 500) {
          // Handle server errors gracefully
          console.error('Server error fetching usage breakdown');
          setEvents([]);
          setTotalCount(0);
          setTotalPages(1);
          return;
        }
        throw new Error('Failed to fetch usage breakdown');
      }

      const data = await response.json();
      setEvents(data.events || []);
      setCurrentPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching usage breakdown:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to load usage data",
        variant: "destructive",
      });
      // Set empty state on error
      setEvents([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchEvents(1);
    }
  }, [organizationId, jobTypeFilter, isOverageFilter, startDate, endDate]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchEvents(page);
    }
  };

  const clearFilters = () => {
    setJobTypeFilter("all");
    setIsOverageFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const formatJobType = (type: UsageType | null) => {
    if (!type) return "Unknown";
    const pricing = getFeaturePricing(type);
    return pricing.name;
  };

  const getJobIcon = (type: UsageType | null) => {
    switch (type) {
      case "deep_research": return <Search className="h-4 w-4 text-blue-500" />;
      case "pre_lander": return <Layout className="h-4 w-4 text-purple-500" />;
      case "static_ads": return <FileText className="h-4 w-4 text-emerald-500" />;
      case "templates_images": return <ImageIcon className="h-4 w-4 text-orange-500" />;
      default: return <Zap className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return { date: 'Invalid date', time: '' };
      }
      
      // Format: 09-Feb-2026
      const d = date.getDate().toString().padStart(2, '0');
      const m = date.toLocaleString('en-US', { month: 'short' });
      const y = date.getFullYear();
      
      // Format time: 12:30:45 AM
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      return { 
        date: `${d}-${m}-${y}`,
        time: time
      };
    } catch (error) {
      return { date: 'Invalid date', time: '' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Ultra-Premium Unified Filter Bar */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
              <p className="text-xs text-muted-foreground font-medium">Monitor your credit consumption across all features</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-muted shadow-sm">
              <Select value={jobTypeFilter} onValueChange={(value: any) => setJobTypeFilter(value)}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 w-[140px] text-xs font-medium">
                  <SelectValue placeholder="Feature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  <SelectItem value="deep_research">Deep Research</SelectItem>
                  <SelectItem value="pre_lander">Pre Lander</SelectItem>
                  <SelectItem value="static_ads">Static Ads</SelectItem>
                  <SelectItem value="templates_images">Templates & Images</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="w-px h-4 bg-muted-foreground/20 mx-1" />
              
              <Select value={isOverageFilter.toString()} onValueChange={(value) => setIsOverageFilter(value === "true" ? true : value === "false" ? false : "all")}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 w-[130px] text-xs font-medium">
                  <SelectValue placeholder="Usage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Usage</SelectItem>
                  <SelectItem value="false">Included</SelectItem>
                  <SelectItem value="true">Overage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-muted shadow-sm hover:border-primary/30 transition-colors">
              <div className="relative group flex items-center">
                <Calendar className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors pointer-events-none" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  className="h-8 pl-8 pr-2 border-none bg-transparent shadow-none focus:ring-0 text-[11px] font-medium w-[125px] cursor-pointer"
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground/40 mx-1">/</span>
              <div className="relative group flex items-center">
                <Calendar className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors pointer-events-none" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  className="h-8 pl-8 pr-2 border-none bg-transparent shadow-none focus:ring-0 text-[11px] font-medium w-[125px] cursor-pointer"
                />
              </div>
            </div>

            {(jobTypeFilter !== 'all' || isOverageFilter !== 'all' || startDate !== '' || endDate !== '') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-10 w-10 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive group transition-all"
                title="Reset Filters"
              >
                <Filter className="h-4 w-4 rotate-180 group-hover:rotate-0 transition-transform duration-300" />
              </Button>
            )}
          </div>
        </div>

        {/* Compact Summary Row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Events</p>
              <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
            </div>
            <Activity className="h-6 w-6 text-primary/50" />
          </div>

          <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-500 tracking-widest">Plan Included</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                {events.filter(e => !e.isOverage).reduce((sum, e) => sum + e.credits, 0).toLocaleString()} <span className="text-xs font-medium text-muted-foreground italic">credits</span>
              </p>
            </div>
            <Zap className="h-6 w-6 text-green-500/50" />
          </div>

          <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-500 tracking-widest">Overage Billed</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                {events.filter(e => e.isOverage).reduce((sum, e) => sum + e.credits, 0).toLocaleString()} <span className="text-xs font-medium text-muted-foreground italic">credits</span>
              </p>
            </div>
            <TrendingUp className="h-6 w-6 text-orange-500/50" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Loading usage data...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No usage events found matching your criteria.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-4 text-sm">
                      {(() => {
                        const { date, time } = formatDate(event.createdAt);
                        return (
                          <>
                            <div className="font-medium text-foreground">{date}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{time}</div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-transparent group-hover:border-primary/20 transition-colors">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-sm">
                          <div className="font-semibold text-foreground">{event.userName}</div>
                          <div className="text-xs text-muted-foreground ">{event.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-muted group-hover:bg-background transition-colors">
                          {getJobIcon(event.jobType)}
                        </div>
                        <span className="text-sm font-medium">{formatJobType(event.jobType)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm tracking-tighter" style={{ "textBox": "trim-both cap alphabetic" }}>{event.credits}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Credits</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {event.isOverage ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 uppercase tracking-widest border border-orange-200/50 dark:border-orange-800/50">
                          Overage
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 uppercase tracking-widest border border-green-200/50 dark:border-green-800/50">
                          Included
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
