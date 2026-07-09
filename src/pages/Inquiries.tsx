import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInquiries, useInquiryStats } from "@/hooks/useInquiries";
import { InquiryTable } from "@/components/inquiries/InquiryTable";
import { InquiryDetailModal } from "@/components/inquiries/InquiryDetailModal";
import { MessageSquare, Search, AlertCircle, Clock, CheckCircle2, XCircle, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Inquiries() {
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useInquiryStats();
  const { data: inquiries, isLoading } = useInquiries({
    status: statusFilter,
    type: typeFilter,
    urgency: urgencyFilter,
    search: searchQuery,
  });

  // Use the current deployment origin so the link works on whatever domain
  // the app is hosted on (no hardcoded host).
  const inquiryUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/submit-inquiry`
      : "/submit-inquiry";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inquiryUrl);
    toast({
      title: "Link copied!",
      description: "Inquiry submission link copied to clipboard.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Inquiries</h1>
        <p className="text-muted-foreground">Manage and respond to customer inquiries</p>
      </div>

      {/* Inquiry Submission Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <a
                href={inquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate"
              >
                {inquiryUrl}
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Inquiries</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.new || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.in_review || 0}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responded</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.responded || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting customer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {statsLoading ? '-' : stats?.urgent || 0}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : stats?.closed || 0}</div>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inquiries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="converted_to_order">Converted to Order</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="new_order">New Order</SelectItem>
                <SelectItem value="order_status">Order Status</SelectItem>
                <SelectItem value="product_question">Product Question</SelectItem>
                <SelectItem value="pricing">Pricing</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Urgencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgencies</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inquiries Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Inquiries</CardTitle>
          <CardDescription>
            {inquiries?.length || 0} inquiries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InquiryTable
            inquiries={inquiries || []}
            isLoading={isLoading}
            onInquiryClick={(id) => setSelectedInquiryId(id)}
          />
        </CardContent>
      </Card>

      {/* Inquiry Detail Modal */}
      {selectedInquiryId && (
        <InquiryDetailModal
          inquiryId={selectedInquiryId}
          open={!!selectedInquiryId}
          onOpenChange={(open) => !open && setSelectedInquiryId(null)}
        />
      )}
    </div>
  );
}
