import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreateInquiry } from "@/hooks/useInquiries";
import { useCreateInquiryOrderDetail } from "@/hooks/useInquiryOrderDetails";
import { useCreateInquiryMessage } from "@/hooks/useInquiryMessages";
import { MessageSquare, ArrowLeft } from "lucide-react";

const inquirySchema = z.object({
  customer_name: z.string().trim().min(1, "Name is required").max(100),
  customer_email: z.string().trim().email("Invalid email address").max(255),
  customer_phone: z.string().trim().optional(),
  company_name: z.string().trim().optional(),
  inquiry_type: z.enum(['new_order', 'order_status', 'product_question', 'pricing', 'general']),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(2000),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']),
  
  // New order fields
  po_number: z.string().trim().optional(),
  order_type: z.enum(['production', 'rd_sample', 'rd_development']).optional(),
  special_requirements: z.string().trim().optional(),
  
  // Order status fields
  order_number: z.string().trim().optional(),
}).refine((data) => {
  if (data.inquiry_type === 'new_order') {
    return data.po_number && data.po_number.length > 0;
  }
  return true;
}, {
  message: "PO Number is required for new orders",
  path: ["po_number"],
});

type InquiryFormData = z.infer<typeof inquirySchema>;

export default function SubmitInquiry() {
  const navigate = useNavigate();
  const [submittedInquiryNumber, setSubmittedInquiryNumber] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{
    id: string;
    product_name: string;
    formula_code: string;
    bottles_quantity: string;
    count_per_bottle: string;
    expected_delivery_date: string;
  }>>([{
    id: crypto.randomUUID(),
    product_name: '',
    formula_code: '',
    bottles_quantity: '',
    count_per_bottle: '',
    expected_delivery_date: '',
  }]);

  const createInquiry = useCreateInquiry();
  const createOrderDetail = useCreateInquiryOrderDetail();
  const createMessage = useCreateInquiryMessage();

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      urgency: 'normal',
      inquiry_type: 'general',
    },
  });

  const inquiryType = form.watch('inquiry_type');

  const addProduct = () => {
    setProducts([...products, {
      id: crypto.randomUUID(),
      product_name: '',
      formula_code: '',
      bottles_quantity: '',
      count_per_bottle: '',
      expected_delivery_date: '',
    }]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const updateProduct = (id: string, field: string, value: string) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  useEffect(() => {
    if (inquiryType !== 'new_order') {
      setProducts([{
        id: crypto.randomUUID(),
        product_name: '',
        formula_code: '',
        bottles_quantity: '',
        count_per_bottle: '',
        expected_delivery_date: '',
      }]);
    }
  }, [inquiryType]);

  const onSubmit = async (data: InquiryFormData) => {
    try {
      // Create the inquiry
      const inquiry = await createInquiry.mutateAsync({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        company_name: data.company_name,
        inquiry_type: data.inquiry_type,
        subject: data.subject,
        message: data.message,
        urgency: data.urgency,
      });

      // Create initial message
      await createMessage.mutateAsync({
        inquiry_id: inquiry.id,
        message: data.message,
        sender_type: 'customer',
        sender_name: data.customer_name,
        sender_email: data.customer_email,
        is_internal_note: false,
      });

      // If it's a new order inquiry, save order details with products
      if (data.inquiry_type === 'new_order') {
        const productsData = products
          .filter(p => p.product_name.trim())
          .map(p => ({
            id: p.id,
            product_name: p.product_name,
            formula_code: p.formula_code || undefined,
            bottles_quantity: parseInt(p.bottles_quantity) || 0,
            count_per_bottle: parseInt(p.count_per_bottle) || 0,
            expected_delivery_date: p.expected_delivery_date || undefined,
          }));

        await createOrderDetail.mutateAsync({
          inquiry_id: inquiry.id,
          po_number: data.po_number,
          products: productsData,
          order_type: data.order_type,
          special_requirements: data.special_requirements,
        });
      }

      setSubmittedInquiryNumber(inquiry.inquiry_number);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
    }
  };

  if (submittedInquiryNumber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Inquiry Submitted Successfully!</CardTitle>
            <CardDescription className="text-center">
              Your inquiry has been received and assigned the following reference number:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Reference Number</p>
              <p className="text-2xl font-bold text-primary">{submittedInquiryNumber}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              We'll review your inquiry and respond within 24-48 hours. A confirmation email has been sent to your email address.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <CardTitle>Submit an Inquiry</CardTitle>
            </div>
            <CardDescription>
              Fill out the form below and we'll get back to you as soon as possible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Your Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="john@example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customer_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" placeholder="(555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Acme Inc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Inquiry Type */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Inquiry Details</h3>

                  <FormField
                    control={form.control}
                    name="inquiry_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What can we help you with? *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select inquiry type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new_order">New Order Request</SelectItem>
                            <SelectItem value="order_status">Order Status Update</SelectItem>
                            <SelectItem value="product_question">Product Information</SelectItem>
                            <SelectItem value="pricing">Pricing Request</SelectItem>
                            <SelectItem value="general">General Question</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="urgency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Brief summary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Please provide details about your inquiry..." 
                            rows={5}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Conditional Fields for New Order */}
                {inquiryType === 'new_order' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold">Order Details</h3>

                    {/* PO Number - Required */}
                    <FormField
                      control={form.control}
                      name="po_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PO Number *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="PO-2025-001" required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="order_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="rd_sample">R&D Sample</SelectItem>
                              <SelectItem value="rd_development">R&D Development</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Products Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold">Products *</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addProduct}
                        >
                          + Add Product
                        </Button>
                      </div>

                      {products.map((product, index) => (
                        <Card key={product.id} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Product #{index + 1}</span>
                              {products.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeProduct(product.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                              <div>
                                <Label>Product Name *</Label>
                                <Input
                                  value={product.product_name}
                                  onChange={(e) => updateProduct(product.id, 'product_name', e.target.value)}
                                  placeholder="Product or formula name"
                                  required
                                />
                              </div>

                              <div>
                                <Label>Formula Code</Label>
                                <Input
                                  value={product.formula_code}
                                  onChange={(e) => updateProduct(product.id, 'formula_code', e.target.value)}
                                  placeholder="e.g., F-123"
                                />
                              </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-3">
                              <div>
                                <Label>Number of Bottles *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={product.bottles_quantity}
                                  onChange={(e) => updateProduct(product.id, 'bottles_quantity', e.target.value)}
                                  placeholder="1000"
                                  required
                                />
                              </div>

                              <div>
                                <Label>Count per Bottle *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={product.count_per_bottle}
                                  onChange={(e) => updateProduct(product.id, 'count_per_bottle', e.target.value)}
                                  placeholder="60"
                                  required
                                />
                              </div>

                              <div>
                                <Label>Expected Delivery</Label>
                                <Input
                                  type="date"
                                  value={product.expected_delivery_date}
                                  onChange={(e) => updateProduct(product.id, 'expected_delivery_date', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <FormField
                      control={form.control}
                      name="special_requirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Requirements</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Any special packaging, labeling, or delivery instructions..." 
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Conditional Fields for Order Status */}
                {inquiryType === 'order_status' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold">Order Information</h3>

                    <FormField
                      control={form.control}
                      name="order_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., ORD-2025-001" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createInquiry.isPending}
                >
                  {createInquiry.isPending ? "Submitting..." : "Submit Inquiry"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
