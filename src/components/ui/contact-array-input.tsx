import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { ContactItem } from '@/hooks/useVendors';

interface ContactArrayInputProps {
  title: string;
  contacts: ContactItem[];
  onChange: (contacts: ContactItem[]) => void;
  placeholder: string;
  types: { value: string; label: string }[];
}

export function ContactArrayInput({ title, contacts, onChange, placeholder, types }: ContactArrayInputProps) {
  const addContact = () => {
    const newContact: ContactItem = {
      id: crypto.randomUUID(),
      value: '',
      type: types[0]?.value || 'other',
    };
    onChange([...contacts, newContact]);
  };

  const updateContact = (id: string, field: keyof ContactItem, value: string) => {
    onChange(contacts.map(contact => 
      contact.id === id ? { ...contact, [field]: value } : contact
    ));
  };

  const removeContact = (id: string) => {
    onChange(contacts.filter(contact => contact.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{title} (Optional)</label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addContact}
          className="h-8 px-3"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {contacts.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          No {title.toLowerCase()} added yet
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex gap-2 items-center">
              <div className="flex-1">
                <Input
                  placeholder={placeholder}
                  value={contact.value}
                  onChange={(e) => updateContact(contact.id, 'value', e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="w-32">
                <Select 
                  value={contact.type} 
                  onValueChange={(value) => updateContact(contact.id, 'type', value)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeContact(contact.id)}
                className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}