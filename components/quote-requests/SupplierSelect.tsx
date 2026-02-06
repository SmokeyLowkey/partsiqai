'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, X, Star } from 'lucide-react';
import { SupplierSummary } from '@/types/quote-request';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  contactPerson: string | null;
  phone: string | null;
  rating: number | null;
}

interface SupplierSelectProps {
  selectedSuppliers: SupplierSummary[];
  onSuppliersChange: (suppliers: SupplierSummary[]) => void;
  disabled?: boolean;
}

export function SupplierSelect({
  selectedSuppliers,
  onSuppliersChange,
  disabled = false,
}: SupplierSelectProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?status=ACTIVE');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplier = (supplier: Supplier) => {
    const isSelected = selectedSuppliers.some((s) => s.id === supplier.id);
    if (isSelected) {
      onSuppliersChange(selectedSuppliers.filter((s) => s.id !== supplier.id));
    } else {
      onSuppliersChange([
        ...selectedSuppliers,
        {
          id: supplier.id,
          name: supplier.name,
          email: supplier.email,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone,
          rating: supplier.rating,
        },
      ]);
    }
  };

  const removeSupplier = (supplierId: string) => {
    onSuppliersChange(selectedSuppliers.filter((s) => s.id !== supplierId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {selectedSuppliers.length === 0
                ? 'Select suppliers...'
                : `${selectedSuppliers.length} supplier${selectedSuppliers.length > 1 ? 's' : ''} selected`}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search suppliers..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading...' : 'No suppliers found.'}
              </CommandEmpty>
              <CommandGroup>
                {suppliers.map((supplier) => {
                  const isSelected = selectedSuppliers.some(
                    (s) => s.id === supplier.id
                  );
                  return (
                    <CommandItem
                      key={supplier.id}
                      onSelect={() => toggleSupplier(supplier)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {supplier.name}
                            </span>
                            {supplier.rating && (
                              <div className="flex items-center gap-0.5 text-yellow-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs">{supplier.rating}</span>
                              </div>
                            )}
                          </div>
                          {supplier.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {supplier.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Suppliers Tags */}
      {selectedSuppliers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSuppliers.map((supplier) => (
            <Badge
              key={supplier.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {supplier.name}
              {!disabled && (
                <button
                  onClick={() => removeSupplier(supplier.id)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
