'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, PhoneCall, AlertCircle, Clock, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type ContactMethod = 'email' | 'both';

interface SupplierContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  doNotCall?: boolean;
  callWindowStart?: string | null;
  callWindowEnd?: string | null;
  timezone?: string | null;
}

interface SupplierMethodSelectorProps {
  suppliers: SupplierContact[];
  defaultMethod?: ContactMethod;
  onChange: (method: ContactMethod) => void;
}

export function SupplierMethodSelector({
  suppliers,
  defaultMethod = 'email',
  onChange,
}: SupplierMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod>(defaultMethod);

  // Check if any supplier can be called
  const suppliersWithPhone = suppliers.filter(
    (s) => s.phone && !s.doNotCall
  );
  const suppliersWithEmail = suppliers.filter((s) => s.email);
  const doNotCallSuppliers = suppliers.filter((s) => s.doNotCall);

  const canCall = suppliersWithPhone.length > 0;
  const canEmail = suppliersWithEmail.length > 0;

  const handleMethodChange = (value: ContactMethod) => {
    setSelectedMethod(value);
    onChange(value);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Communication Method</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how to contact suppliers for this quote request
        </p>
      </div>

      <RadioGroup
        value={selectedMethod}
        onValueChange={(value) => handleMethodChange(value as ContactMethod)}
        className="grid gap-3"
      >
        {/* Email Only */}
        <Card
          className={`cursor-pointer transition-colors ${
            selectedMethod === 'email'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${!canEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => canEmail && handleMethodChange('email')}
        >
          <CardContent className="flex items-start space-x-4 p-4">
            <RadioGroupItem value="email" id="method-email" disabled={!canEmail} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <Label
                  htmlFor="method-email"
                  className="font-medium cursor-pointer"
                >
                  Email Only
                </Label>
                <Badge variant="outline" className="ml-auto">
                  Traditional
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Send quote requests via email. Suppliers respond in their own time.
              </p>
              {!canEmail && (
                <p className="text-sm text-destructive">
                  ⚠️ No suppliers have email addresses configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Both (Email + Call) */}
        <Card
          className={`cursor-pointer transition-colors ${
            selectedMethod === 'both'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${!canCall || !canEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => canCall && canEmail && handleMethodChange('both')}
        >
          <CardContent className="flex items-start space-x-4 p-4">
            <RadioGroupItem
              value="both"
              id="method-both"
              disabled={!canCall || !canEmail}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-purple-500" />
                <Label htmlFor="method-both" className="font-medium cursor-pointer">
                  Email + Call
                </Label>
                <Badge variant="outline" className="ml-auto bg-purple-50 text-purple-700 border-purple-200">
                  Fastest
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Send emails and call simultaneously for maximum speed. Get quotes
                from multiple channels.
              </p>
              {(!canCall || !canEmail) && (
                <p className="text-sm text-destructive">
                  ⚠️ Requires suppliers with both email and phone
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </RadioGroup>

      {/* Warnings and Info */}
      {doNotCallSuppliers.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{doNotCallSuppliers.length} supplier(s)</strong> marked as "Do Not
            Call": {doNotCallSuppliers.map((s) => s.name).join(', ')}. They will only
            receive emails.
          </AlertDescription>
        </Alert>
      )}

      {canCall && selectedMethod !== 'email' && (
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>AI Calling Info:</strong> The AI agent will call during business
            hours and extract pricing information automatically. You'll see live call
            status and transcripts.
          </AlertDescription>
        </Alert>
      )}

      {/* Supplier Details */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Selected Suppliers</Label>
        <div className="grid gap-2">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex items-center justify-between p-2 rounded-md border bg-card text-sm"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{supplier.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {supplier.email && (
                  <Badge variant="outline" className="gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </Badge>
                )}
                {supplier.phone && !supplier.doNotCall && (
                  <Badge variant="outline" className="gap-1">
                    <Phone className="h-3 w-3" />
                    Call
                  </Badge>
                )}
                {supplier.doNotCall && (
                  <Badge variant="destructive" className="gap-1">
                    No Call
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
