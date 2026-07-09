import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inquiry } from "@/hooks/useInquiries";
import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";
import { formatDistanceET } from "@/utils/dateUtils";

interface InquiryTableProps {
  inquiries: Inquiry[];
  isLoading: boolean;
  onInquiryClick: (id: string) => void;
}

export function InquiryTable({ inquiries, isLoading, onInquiryClick }: InquiryTableProps) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading inquiries...</div>;
  }

  if (!inquiries || inquiries.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No inquiries found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'in_review': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      case 'responded': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'converted_to_order': return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
      default: return '';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20';
      case 'normal': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'low': return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
      default: return '';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new_order': return 'New Order';
      case 'order_status': return 'Order Status';
      case 'product_question': return 'Product Question';
      case 'pricing': return 'Pricing';
      case 'general': return 'General';
      default: return type;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inquiry #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Urgency</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry) => (
            <TableRow key={inquiry.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell className="font-mono text-sm">{inquiry.inquiry_number}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{inquiry.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{inquiry.customer_email}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getTypeLabel(inquiry.inquiry_type)}</Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">{inquiry.subject}</TableCell>
              <TableCell>
                <Badge className={getStatusColor(inquiry.status)}>
                  {inquiry.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={getUrgencyColor(inquiry.urgency)}>
                  {inquiry.urgency}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceET(inquiry.created_at, { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onInquiryClick(inquiry.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
