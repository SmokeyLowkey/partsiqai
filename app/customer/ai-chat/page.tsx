"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";
import {
  Bot,
  User,
  Send,
  Paperclip,
  Sparkles,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Plus,
  MessageSquare,
  Truck,
  Package,
  ShoppingCart,
  Trash2,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link as LinkIcon,
  Filter,
  Search,
  Menu,
} from "lucide-react";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  metadata?: {
    formattedResponse?: FormattedSearchResponse;
  };
}

interface FormattedSearchResponse {
  messageText: string;
  messageHtml: string;
  parts: FormattedPart[];
  summary: {
    totalFound: number;
    topMatch?: string;
    averagePrice?: number;
    avgConfidence?: number;
    inStockCount: number;
    categoryBreakdown: Record<string, number>;
  };
  recommendations: Recommendation[];
  filters: FilterOption[];
  relatedSearches: string[];
  metadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
    hasMoreResults: boolean;
  };
}

interface FormattedPart {
  partNumber: string;
  description: string;
  price?: number;
  priceFormatted?: string;
  stockQuantity?: number;
  stockStatus: string;
  category?: string;
  confidence: number;
  confidenceLabel: string;
  availability: string;
  badges: Badge[];
  supplier?: string;
  compatibility?: {
    vehicles?: any[];
    relationships?: any[];
    models?: string[];
    manufacturers?: string[];
    serialRanges?: string[];
    categories?: string[];
    domains?: string[];
  };
  foundBy?: string[];
  metadata?: {
    diagramTitle?: string;
    categoryBreadcrumb?: string;
    text?: string;
    sourceUrl?: string;
    quantity?: string;
    remarks?: string;
    partKey?: number;
    mergedEntries?: Array<{
      diagramTitle?: string;
      quantity?: string;
      remarks?: string;
      sourceUrl?: string;
      partKey?: number;
    }>;
  };
  callToAction: string;
}

interface Badge {
  text: string;
  variant: 'success' | 'warning' | 'info' | 'default';
  icon?: string;
}

interface Recommendation {
  type: 'alternative' | 'upgrade' | 'bundle' | 'related';
  title: string;
  description: string;
  partNumbers: string[];
}

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  isActive: boolean;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
  };
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  serialNumber?: string;
}

interface PickListItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  price?: number;
  supplier?: string;
}

export default function AIChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [pickList, setPickList] = useState<PickListItem[]>([]);
  const [showNewConversationDialog, setShowNewConversationDialog] =
    useState(false);
  const [showMobileConversations, setShowMobileConversations] = useState(false);
  const [showMobilePickList, setShowMobilePickList] = useState(false);
  const isMobile = useIsMobile();
  const [hasOpenRouter, setHasOpenRouter] = useState<boolean | null>(null);
  const [creatingQuoteRequest, setCreatingQuoteRequest] = useState(false);
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});
  const [showAllResults, setShowAllResults] = useState<Record<string, boolean>>({});
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Log state changes
  useEffect(() => {
    console.log("[AI Chat] State - conversations updated:", conversations.length, "items");
    conversations.forEach((conv, idx) => {
      console.log(`[AI Chat]   Conversation ${idx}:`, {
        id: conv.id,
        title: conv.title,
        hasVehicle: !!conv.vehicle,
        vehicle: conv.vehicle
      });
    });
  }, [conversations]);

  useEffect(() => {
    console.log("[AI Chat] State - selectedVehicle updated:", selectedVehicle);
  }, [selectedVehicle]);

  useEffect(() => {
    console.log("[AI Chat] State - conversationId updated:", conversationId);
  }, [conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load initial data
  useEffect(() => {
    console.log("[AI Chat] Component mounted, loading initial data...");
    loadConversations();
    loadVehicles();
    checkIntegrations();
  }, []);

  const checkIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations/openrouter");
      if (response.ok) {
        const data = await response.json();
        setHasOpenRouter(data.hasCredentials);
      } else {
        setHasOpenRouter(false);
      }
    } catch (error) {
      console.error("Error checking integrations:", error);
      setHasOpenRouter(false);
    }
  };

  const loadConversations = async () => {
    try {
      console.log("[AI Chat] Loading conversations...");
      const response = await fetch("/api/chat/conversations");
      console.log("[AI Chat] Conversations API response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("[AI Chat] Conversations data received:", data);
        console.log("[AI Chat] Number of conversations:", data.conversations?.length);
        console.log("[AI Chat] First conversation (if exists):", data.conversations?.[0]);
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("[AI Chat] Error loading conversations:", error);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await fetch("/api/vehicles");
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles || []);
      }
    } catch (error) {
      console.error("Error loading vehicles:", error);
    }
  };

  const loadConversationMessages = async (convId: string) => {
    try {
      console.log("[AI Chat] Loading messages for conversation:", convId);
      const response = await fetch(
        `/api/chat/message?conversationId=${convId}`
      );
      console.log("[AI Chat] Messages API response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("[AI Chat] Messages data received:", data);
        setMessages(data.messages || []);
        setConversationId(convId);

        // Set vehicle context if this conversation has one
        console.log("[AI Chat] Current conversations array:", conversations);
        console.log("[AI Chat] Looking for conversation ID:", convId);
        const conversation = conversations.find(c => c.id === convId);
        console.log("[AI Chat] Found conversation:", conversation);
        console.log("[AI Chat] Conversation has vehicle?", !!conversation?.vehicle);
        console.log("[AI Chat] Vehicle data:", conversation?.vehicle);

        if (conversation?.vehicle) {
          console.log("[AI Chat] Setting vehicle context:", conversation.vehicle);
          setSelectedVehicle(conversation.vehicle);
        } else {
          console.log("[AI Chat] No vehicle context found, clearing selected vehicle");
          console.log("[AI Chat] Reason: conversation not found or has no vehicle");
          setSelectedVehicle(null);
        }
      }
    } catch (error) {
      console.error("[AI Chat] Error loading conversation:", error);
    }
  };

  const startNewConversation = () => {
    trackEvent(AnalyticsEvents.AI_CHAT_SESSION_STARTED);
    console.log("[AI Chat] Starting new conversation, keeping selected vehicle:", selectedVehicle);
    setMessages([]);
    setConversationId(null);
    // Don't clear selectedVehicle - keep it for the new conversation
    setPickList([]);
    setShowNewConversationDialog(false);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the conversation selection

    if (!confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/conversations/${convId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove from state
        setConversations((prev) => prev.filter((c) => c.id !== convId));

        // If this was the active conversation, clear the messages
        if (conversationId === convId) {
          setMessages([]);
          setConversationId(null);
          setSelectedVehicle(null);
          setPickList([]);
        }
      } else {
        alert("Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      alert("Failed to delete conversation");
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Save the input value before clearing it
    const messageText = input.trim();

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: messageText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    trackEvent(AnalyticsEvents.AI_CHAT_MESSAGE_SENT);

    try {
      // Call the chat API with vehicle context
      const requestBody: any = {
        conversationId,
        message: messageText,
      };

      if (selectedVehicle) {
        requestBody.vehicleContext = {
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          year: selectedVehicle.year,
          vehicleId: selectedVehicle.id,
        };
      }

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Update conversation ID if new
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        await loadConversations(); // Refresh conversation list
      }

      // Add assistant message - use the proper metadata structure
      if (data.assistantMessage) {
        // Replace the temporary user message with the saved one
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.id !== userMessage.id);

          const savedUserMsg: Message = {
            id: data.userMessage.id,
            role: "USER",
            content: data.userMessage.content,
            createdAt: data.userMessage.createdAt,
          };

          const assistantMsg: Message = {
            id: data.assistantMessage.id,
            role: "ASSISTANT",
            content: data.assistantMessage.content,
            createdAt: data.assistantMessage.createdAt,
            metadata: data.assistantMessage.metadata || data.searchResults ? {
              formattedResponse: data.searchResults || data.assistantMessage.metadata?.formattedResponse
            } : undefined,
          };

          return [...filtered, savedUserMsg, assistantMsg];
        });

        // Extract parts from response if available
        const formattedResponse = data.searchResults || data.assistantMessage.metadata?.formattedResponse;
        if (formattedResponse?.parts) {
          // Show pick list panel when parts are available
          setShowMobilePickList(true);
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);

      // Show error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "ASSISTANT",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractPartsToPickList = (parts: FormattedPart[]) => {
    // Don't auto-add parts, just make them available
    // User will manually add them using "Add to Pick List" button
  };

  const addToPickList = (part: FormattedPart) => {
    const existingItem = pickList.find((p) => p.partNumber === part.partNumber);

    if (existingItem) {
      // Increment quantity
      setPickList((prev) =>
        prev.map((p) =>
          p.partNumber === part.partNumber
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )
      );
    } else {
      // Add new item
      const newItem: PickListItem = {
        id: `pick-${Date.now()}-${part.partNumber}`,
        partNumber: part.partNumber,
        description: part.description,
        quantity: 1,
        price: part.price,
        supplier: part.supplier,
      };
      setPickList((prev) => [...prev, newItem]);
      setShowMobilePickList(true);
    }
  };

  const removeFromPickList = (id: string) => {
    setPickList((prev) => prev.filter((item) => item.id !== id));
  };

  const createPickListOrder = async () => {
    if (pickList.length === 0) return;

    setCreatingQuoteRequest(true);

    try {
      // Step 1: Create a ChatPickList linked to this conversation
      const pickListResponse = await fetch("/api/chat/pick-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          items: pickList,
          vehicleId: selectedVehicle?.id,
        }),
      });

      if (!pickListResponse.ok) {
        throw new Error("Failed to create pick list");
      }

      const pickListData = await pickListResponse.json();

      // Step 2: Create a QuoteRequest from the pick list
      const quoteRequestResponse = await fetch("/api/quote-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickListId: pickListData.pickList.id,
          vehicleId: selectedVehicle?.id,
          title: `Quote Request - ${new Date().toLocaleDateString()}`,
        }),
      });

      if (!quoteRequestResponse.ok) {
        throw new Error("Failed to create quote request");
      }

      const quoteRequestData = await quoteRequestResponse.json();

      // Clear the pick list and redirect to quote request page
      setPickList([]);
      setShowMobilePickList(false);

      // Redirect to the quote request detail page
      router.push(`/customer/quote-requests/${quoteRequestData.quoteRequest.id}`);
    } catch (error) {
      console.error("Error creating quote request:", error);
      alert("Failed to create quote request. Please try again.");
    } finally {
      setCreatingQuoteRequest(false);
    }
  };

  const renderAssistantMessage = (message: Message) => {
    const formattedResponse = message.metadata?.formattedResponse;

    if (!formattedResponse) {
      return <p className="text-sm">{message.content}</p>;
    }

    const messageKey = message.id;
    const showAll = showAllResults[messageKey] || false;
    const displayedParts = showAll ? formattedResponse.parts : formattedResponse.parts.slice(0, 5);

    return (
      <div className="space-y-3">
        <p className="text-sm">{formattedResponse.messageText}</p>

        {/* Search Summary */}
        {formattedResponse.summary && (
          <div className="text-xs bg-muted p-2 rounded">
            <div className="flex justify-between">
              <span>
                Found {formattedResponse.summary.totalFound} results
              </span>
              {formattedResponse.summary.avgConfidence !== undefined && (
                <span>
                  Avg confidence: {formattedResponse.summary.avgConfidence}%
                </span>
              )}
            </div>
            {formattedResponse.metadata && (
              <div className="text-muted-foreground mt-1">
                Search time: {formattedResponse.metadata.searchTime.toFixed(2)}s
                • Sources: {formattedResponse.metadata.sourcesUsed.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        {formattedResponse.filters && formattedResponse.filters.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Filter className="h-3 w-3" />
              <span>Filter Results:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {formattedResponse.filters.map((filter, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant={activeFilters.includes(filter.value) ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => {
                    setActiveFilters(prev =>
                      prev.includes(filter.value)
                        ? prev.filter(f => f !== filter.value)
                        : [...prev, filter.value]
                    );
                  }}
                >
                  {filter.label} ({filter.count})
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Part Results */}
        {formattedResponse.parts && formattedResponse.parts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Parts Found:</p>
            {displayedParts.map((part, index) => {
              const partKey = `${messageKey}-${index}`;
              const isExpanded = expandedParts[partKey] || false;
              
              return (
                <div
                  key={index}
                  className="bg-card border border-border p-3 rounded"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">
                          {part.partNumber}
                        </p>
                        {part.badges && part.badges.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {part.badges.map((badge, i) => (
                              <Badge
                                key={i}
                                variant={badge.variant === 'success' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {badge.icon && <span className="mr-1">{badge.icon}</span>}
                                {badge.text}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {part.description}
                      </p>
                      
                      {/* Source Attribution */}
                      {part.foundBy && part.foundBy.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {part.foundBy.map((source, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={
                        part.confidence >= 90
                          ? "default"
                          : part.confidence >= 70
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {part.confidence}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {part.price && (
                      <div>
                        <span className="text-muted-foreground">Price: </span>
                        <span className="font-medium text-green-600">
                          ${part.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Stock: </span>
                      <span className="font-medium">{part.availability || part.stockStatus}</span>
                    </div>
                    {part.supplier && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Supplier: </span>
                        <span className="font-medium">{part.supplier}</span>
                      </div>
                    )}
                    {part.category && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Category: </span>
                        <span className="font-medium">{part.category}</span>
                      </div>
                    )}
                  </div>

                  {/* Expandable Rich Metadata Section */}
                  {(part.metadata || part.compatibility) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 h-7 text-xs"
                        onClick={() => setExpandedParts(prev => ({
                          ...prev,
                          [partKey]: !isExpanded
                        }))}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show More Details
                          </>
                        )}
                      </Button>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 pt-3 border-t">
                          {/* Pinecone Rich Metadata */}
                          {part.metadata && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Additional Information:</p>
                              {part.metadata.categoryBreadcrumb && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Category Path: </span>
                                  <span className="text-xs">{part.metadata.categoryBreadcrumb}</span>
                                </div>
                              )}
                              {part.metadata.text && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Description: </span>
                                  <span>{part.metadata.text}</span>
                                </div>
                              )}

                              {/* Merged entries — show all locations when part appears in multiple diagrams */}
                              {part.metadata.mergedEntries && part.metadata.mergedEntries.length > 1 ? (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground">
                                    Found in {part.metadata.mergedEntries.length} locations:
                                  </p>
                                  {part.metadata.mergedEntries.map((entry, entryIdx) => (
                                    <div key={entryIdx} className="text-xs bg-muted/50 rounded p-2 space-y-0.5 border border-border/50">
                                      {entry.diagramTitle && (
                                        <div>
                                          <span className="text-muted-foreground">Diagram: </span>
                                          <span>{entry.diagramTitle}</span>
                                        </div>
                                      )}
                                      {entry.quantity && (
                                        <div>
                                          <span className="text-muted-foreground">Qty: </span>
                                          <span>{entry.quantity}</span>
                                        </div>
                                      )}
                                      {entry.remarks && (
                                        <div>
                                          <span className="text-muted-foreground">Remarks: </span>
                                          <span>{entry.remarks}</span>
                                        </div>
                                      )}
                                      {entry.sourceUrl && (
                                        <a
                                          href={entry.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Source
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <>
                                  {/* Single-entry display (no mergedEntries or only 1 entry) */}
                                  {part.metadata.diagramTitle && (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Diagram: </span>
                                      <span>{part.metadata.diagramTitle}</span>
                                    </div>
                                  )}
                                  {part.metadata.quantity && (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Quantity: </span>
                                      <span>{part.metadata.quantity}</span>
                                    </div>
                                  )}
                                  {part.metadata.remarks && (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Remarks: </span>
                                      <span>{part.metadata.remarks}</span>
                                    </div>
                                  )}
                                  {part.metadata.sourceUrl && (
                                    <div className="text-xs">
                                      <a
                                        href={part.metadata.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        View Source Documentation
                                      </a>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* Neo4j Compatibility & Relationships */}
                          {part.compatibility && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Compatibility:</p>
                              {part.compatibility.models && part.compatibility.models.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Models: </span>
                                  <span>{part.compatibility.models.join(", ")}</span>
                                </div>
                              )}
                              {part.compatibility.manufacturers && part.compatibility.manufacturers.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Manufacturers: </span>
                                  <span>{part.compatibility.manufacturers.join(", ")}</span>
                                </div>
                              )}
                              {part.compatibility.serialRanges && part.compatibility.serialRanges.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Serial Ranges: </span>
                                  <span>{part.compatibility.serialRanges.join(", ")}</span>
                                </div>
                              )}
                              {part.compatibility.domains && part.compatibility.domains.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Domains: </span>
                                  <span>{part.compatibility.domains.join(", ")}</span>
                                </div>
                              )}
                              {part.compatibility.relationships && part.compatibility.relationships.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground mb-1 block">Related Parts:</span>
                                  <div className="pl-2 space-y-1">
                                    {part.compatibility.relationships.map((rel: any, i: number) => (
                                      <div key={i} className="flex items-center gap-1">
                                        <LinkIcon className="h-3 w-3" />
                                        <span className="font-medium">{rel.partNumber}</span>
                                        {rel.description && (
                                          <span className="text-muted-foreground">- {rel.description}</span>
                                        )}
                                        {rel.type && (
                                          <Badge variant="outline" className="text-xs ml-1">
                                            {rel.type}
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => addToPickList(part)}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      Add to Pick List
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      Request Quote
                    </Button>
                  </div>
                </div>
              );
            })}

            {formattedResponse.parts.length > 5 && !showAll && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAllResults(prev => ({
                  ...prev,
                  [messageKey]: true
                }))}
              >
                Show {formattedResponse.parts.length - 5} More Results
              </Button>
            )}
            
            {showAll && formattedResponse.parts.length > 5 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAllResults(prev => ({
                  ...prev,
                  [messageKey]: false
                }))}
              >
                Show Less
              </Button>
            )}
          </div>
        )}

        {/* Recommendations Section */}
        {formattedResponse.recommendations && formattedResponse.recommendations.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs font-medium">Recommendations:</p>
            {formattedResponse.recommendations.map((rec, idx) => (
              <div key={idx} className="bg-muted/50 p-2 rounded text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{rec.title}</p>
                    <p className="text-muted-foreground text-xs mb-1">{rec.description}</p>
                    {rec.partNumbers && rec.partNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {rec.partNumbers.map((pn, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {pn}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Related Searches */}
        {formattedResponse.relatedSearches && formattedResponse.relatedSearches.length > 0 && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Search className="h-3 w-3" />
              <span>Related Searches:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {formattedResponse.relatedSearches.map((query, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setInput(query);
                  }}
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Configuration Alert */}
      {hasOpenRouter === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>AI Chat Not Configured</AlertTitle>
          <AlertDescription>
            Please configure OpenRouter API key in{" "}
            <Link href="/customer/settings" className="underline font-semibold">
              Settings
            </Link>{" "}
            to enable AI-powered parts search and chat.
          </AlertDescription>
        </Alert>
      )}

      <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)] flex gap-0 md:gap-4 overflow-hidden">
        {/* Conversation History Sidebar — Desktop: inline Card, Mobile: Sheet overlay */}
        {!isMobile ? (
          <Card className="w-80 flex flex-col overflow-hidden">
            <CardHeader className="border-b pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conversations</CardTitle>
                <Dialog
                  open={showNewConversationDialog}
                  onOpenChange={setShowNewConversationDialog}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New Conversation</DialogTitle>
                      <DialogDescription>
                        Select a vehicle context for this conversation (optional)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Vehicle Context (Optional)
                        </label>
                        <Select
                          onValueChange={(value) => {
                            const vehicle = vehicles.find((v) => v.id === value);
                            setSelectedVehicle(vehicle || null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                {vehicle.year} {vehicle.make} {vehicle.model}
                                {vehicle.serialNumber && ` - ${vehicle.serialNumber}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={startNewConversation} className="w-full">
                        Start Conversation
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`relative group rounded-lg border transition-colors ${
                      conversationId === conv.id
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >
                    <button
                      onClick={() => loadConversationMessages(conv.id)}
                      className="w-full text-left p-3 overflow-hidden"
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0 pr-6">
                          <p
                            className="font-medium text-sm line-clamp-2 break-words"
                            title={conv.title}
                          >
                            {conv.title}
                          </p>
                          {conv.vehicle && (
                            <Badge
                              variant="outline"
                              className="text-xs mt-1 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 max-w-full truncate"
                            >
                              <Truck className="h-2.5 w-2.5 mr-1 shrink-0" />
                              <span className="truncate">
                                {conv.vehicle.year} {conv.vehicle.make} {conv.vehicle.model}
                              </span>
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}</span>
                            <span>•</span>
                            <span>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => deleteConversation(conv.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No conversations yet.
                    <br />
                    Start a new one!
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <Sheet open={showMobileConversations} onOpenChange={setShowMobileConversations}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
              <SheetHeader className="p-4 border-b shrink-0">
                <SheetTitle>Conversations</SheetTitle>
                <SheetDescription>
                  <Dialog
                    open={showNewConversationDialog}
                    onOpenChange={setShowNewConversationDialog}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" className="mt-2 w-full">
                        <Plus className="h-4 w-4 mr-1" />
                        New Conversation
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Conversation</DialogTitle>
                        <DialogDescription>
                          Select a vehicle context for this conversation (optional)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Vehicle Context (Optional)
                          </label>
                          <Select
                            onValueChange={(value) => {
                              const vehicle = vehicles.find((v) => v.id === value);
                              setSelectedVehicle(vehicle || null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a vehicle" />
                            </SelectTrigger>
                            <SelectContent>
                              {vehicles.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.year} {vehicle.make} {vehicle.model}
                                  {vehicle.serialNumber && ` - ${vehicle.serialNumber}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={() => { startNewConversation(); setShowMobileConversations(false); }} className="w-full">
                          Start Conversation
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`relative group rounded-lg border transition-colors ${
                        conversationId === conv.id
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-border hover:bg-muted"
                      }`}
                    >
                      <button
                        onClick={() => { loadConversationMessages(conv.id); setShowMobileConversations(false); }}
                        className="w-full text-left p-3 overflow-hidden"
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0 pr-6">
                            <p
                              className="font-medium text-sm line-clamp-2 break-words"
                              title={conv.title}
                            >
                              {conv.title}
                            </p>
                            {conv.vehicle && (
                              <Badge
                                variant="outline"
                                className="text-xs mt-1 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 max-w-full truncate"
                              >
                                <Truck className="h-2.5 w-2.5 mr-1 shrink-0" />
                                <span className="truncate">
                                  {conv.vehicle.year} {conv.vehicle.make} {conv.vehicle.model}
                                </span>
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}</span>
                              <span>•</span>
                              <span>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => deleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No conversations yet.
                      <br />
                      Start a new one!
                    </div>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        )}

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 h-10 w-10"
                  onClick={() => setShowMobileConversations(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Bot className="h-6 w-6 text-green-600 mr-2" />
              <div>
                <CardTitle className="flex items-center">
                  AI Parts Assistant
                  <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Multi-Agent Search
                  </Badge>
                </CardTitle>
                {(() => {
                  console.log("[AI Chat] Rendering header - selectedVehicle:", selectedVehicle);
                  return null;
                })()}
                {selectedVehicle && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-xs py-1 px-2 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium max-w-[70vw] sm:max-w-none truncate"
                    >
                      <Truck className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">Vehicle Context: {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</span>
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-destructive/10"
                      onClick={() => setSelectedVehicle(null)}
                      title="Remove vehicle context"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {pickList.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobilePickList(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Pick List ({pickList.length})
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="flex justify-start">
                    <div className="max-w-full sm:max-w-[80%]">
                      <div className="flex items-start space-x-2">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-muted text-foreground border border-border rounded-lg p-3">
                          <p className="text-sm">
                            Hello! I'm your AI parts assistant. I can help you
                            identify machinery parts, find suppliers, and manage
                            orders.
                            {selectedVehicle && (
                              <>
                                {" "}I see you've selected the <strong>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</strong> as your vehicle context. I'll use this information to provide more accurate part recommendations.
                              </>
                            )}
                            {" "}What can I help you with today?
                          </p>
                          <div className="flex items-center space-x-1 mt-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-600">Ready</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedVehicle && (
                    <div className="flex justify-center">
                      <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Truck className="h-4 w-4" />
                          <span className="font-medium">
                            New conversation started with vehicle context: {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "USER" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-full sm:max-w-[80%] ${message.role === "USER" ? "order-2" : "order-1"}`}
                  >
                    <div
                      className={`flex items-start space-x-2 ${message.role === "USER" ? "flex-row-reverse space-x-reverse" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === "USER"
                            ? "bg-blue-600"
                            : "bg-green-600"
                        }`}
                      >
                        {message.role === "USER" ? (
                          <User className="h-4 w-4 text-white" />
                        ) : (
                          <Bot className="h-4 w-4 text-white" />
                        )}
                      </div>

                      <div
                        className={`rounded-lg p-3 ${
                          message.role === "USER"
                            ? "bg-blue-600 dark:bg-blue-700 text-white"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        {message.role === "USER" ? (
                          <p className="text-sm">{message.content}</p>
                        ) : (
                          renderAssistantMessage(message)
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs opacity-70">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                          {message.role === "ASSISTANT" && (
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white animate-pulse" />
                    </div>
                    <div className="bg-muted rounded-lg p-3 border border-border">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Searching with multi-agent system...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Pick List — Sheet overlay (all screen sizes) */}
            <Sheet open={showMobilePickList} onOpenChange={setShowMobilePickList}>
              <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="flex items-center">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Pick List ({pickList.length})
                  </SheetTitle>
                  <SheetDescription className="sr-only">Your selected parts</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 pb-24">
                  <div className="p-4 space-y-2">
                    {pickList.map((item) => (
                      <div
                        key={item.id}
                        className="bg-card border border-border rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.partNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => removeFromPickList(item.id)}
                          >
                            ×
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Qty: {item.quantity}</span>
                          {item.price && (
                            <span className="font-medium text-green-600">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                  <Button
                    onClick={() => { createPickListOrder(); setShowMobilePickList(false); }}
                    className="w-full h-12"
                    disabled={pickList.length === 0 || creatingQuoteRequest}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {creatingQuoteRequest
                      ? "Creating Quote Request..."
                      : `Create Quote Request (${pickList.length} items)`}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Separator className="shrink-0" />

          {/* Input Area */}
          <div className="p-3 sm:p-4 bg-background border-t border-border shrink-0">
            <div className="flex space-x-2">
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Describe the part you need..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 h-10 bg-background text-foreground"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="h-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="hidden sm:flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                AI can identify parts, find suppliers, and help with orders
              </span>
              <span>Press Enter to send</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
