import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import {
  callAnthropicStream,
  anthropicStreamToOpenAI,
  MODELS,
} from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keywords to determine which data to fetch
const INVENTORY_KEYWORDS = ['inventory', 'stock', 'left', 'available', 'quantity', 'material', 'ingredient', 'kg', 'kilogram', 'have', 'much', 'how much', 'remaining'];
const SCHEDULE_KEYWORDS = ['schedule', 'scheduled', 'production', 'next week', 'today', 'tomorrow', 'batch', 'batches', 'when', 'this week', 'rest of'];
const ORDER_KEYWORDS = ['order', 'po', 'purchase order', 'customer', 'due', 'delivery', 'ship', 'pending'];
const FORMULA_KEYWORDS = ['formula', 'recipe', 'batch size', 'can make', 'how many batches', 'capacity'];

// Stop words to exclude when extracting potential material names
const STOP_WORDS = ['how', 'much', 'many', 'what', 'is', 'are', 'we', 'have', 'do', 'the', 'a', 'an', 'in', 'on', 'to', 'for', 'of', 'and', 'or', 'with', 'can', 'make', 'left', 'available', 'current', 'total', 'get', 'there', 'any', 'some', 'all', 'about', 'tell', 'me', 'show', 'list', 'give', 'need', 'want', 'check', 'know', 'does', 'did', 'will', 'would', 'could', 'should', 'been', 'being', 'was', 'were', 'has', 'had', 'having', 'this', 'that', 'these', 'those', 'from', 'into', 'our', 'your', 'their', 'its', 'my'];

function containsKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

// Extract meaningful words that could be material names from the question
function extractSearchTerms(question: string): string[] {
  const lowerQuestion = question.toLowerCase();
  
  // Remove punctuation and split into words
  const words = lowerQuestion.replace(/[^\w\s]/g, '').split(/\s+/).filter(word => 
    word.length > 2 && !STOP_WORDS.includes(word)
  );
  
  // Create phrase combinations (e.g., "strawberry flavor" from adjacent words)
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  
  // Return unique terms: phrases first (more specific), then individual words
  return [...new Set([...phrases, ...words])];
}

async function gatherContext(supabase: any, question: string) {
  const context: any = {};
  const lowerQuestion = question.toLowerCase();
  
  // Extract potential material names intelligently from the question
  const searchTerms = extractSearchTerms(question);
  const hasInventoryKeywords = containsKeywords(question, INVENTORY_KEYWORDS);
  
  console.log('Extracted search terms:', searchTerms);
  
  try {
    // Fetch inventory data if asking about materials/inventory OR if we extracted search terms
    if (hasInventoryKeywords || searchTerms.length > 0) {
      console.log('Fetching inventory data...');
      
      // Search for specific materials using extracted terms
      if (searchTerms.length > 0) {
        for (const term of searchTerms) {
          const { data: materials, error } = await supabase
            .from('raw_materials')
            .select(`
              id,
              name,
              raw_material_lots!fk_raw_material_lots_raw_material_id (
                id,
                lot_number,
                quantity,
                cost,
                expires_on,
                receiving_date
              )
            `)
            .ilike('name', `%${term}%`)
            .limit(25);
          
          if (error) {
            console.error('Error fetching materials:', error);
          } else if (materials && materials.length > 0) {
            context.searchedMaterials = context.searchedMaterials || [];
            // Avoid duplicates
            for (const mat of materials) {
              if (!context.searchedMaterials.some((m: any) => m.id === mat.id)) {
                context.searchedMaterials.push(mat);
              }
            }
            console.log(`Found ${materials.length} materials matching "${term}"`);
          }
        }
      }
      
      // Get all materials with inventory
      const { data: allMaterials, error: allError } = await supabase
        .from('raw_materials')
        .select(`
          id,
          name,
          raw_material_lots!fk_raw_material_lots_raw_material_id (
            quantity
          )
        `)
        .limit(50);
      
      if (!allError && allMaterials) {
        context.allMaterials = allMaterials.map((m: any) => ({
          name: m.name,
          totalQuantity: m.raw_material_lots?.reduce((sum: number, lot: any) => sum + (parseFloat(lot.quantity) || 0), 0) || 0
        })).filter((m: any) => m.totalQuantity > 0);
        console.log(`Fetched ${context.allMaterials.length} materials with inventory`);
      }
    }
    
    // Fetch schedule data - FIXED: correct column names and joins
    if (containsKeywords(question, SCHEDULE_KEYWORDS)) {
      console.log('Fetching schedule data...');
      
      // Try to extract a specific date from the question
      let startDate: string;
      let endDate: string;
      let specificDate: Date | null = null;
      
      // Parse "dec 4th", "december 4", etc.
      const decMatch = question.match(/(?:dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const janMatch = question.match(/(?:jan(?:uary)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const febMatch = question.match(/(?:feb(?:ruary)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const marMatch = question.match(/(?:mar(?:ch)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const aprMatch = question.match(/(?:apr(?:il)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const mayMatch = question.match(/(?:may)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const junMatch = question.match(/(?:jun(?:e)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const julMatch = question.match(/(?:jul(?:y)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const augMatch = question.match(/(?:aug(?:ust)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const sepMatch = question.match(/(?:sep(?:tember)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const octMatch = question.match(/(?:oct(?:ober)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      const novMatch = question.match(/(?:nov(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i);
      
      const currentYear = new Date().getFullYear();
      
      if (decMatch) {
        specificDate = new Date(currentYear, 11, parseInt(decMatch[1]));
      } else if (janMatch) {
        specificDate = new Date(currentYear, 0, parseInt(janMatch[1]));
      } else if (febMatch) {
        specificDate = new Date(currentYear, 1, parseInt(febMatch[1]));
      } else if (marMatch) {
        specificDate = new Date(currentYear, 2, parseInt(marMatch[1]));
      } else if (aprMatch) {
        specificDate = new Date(currentYear, 3, parseInt(aprMatch[1]));
      } else if (mayMatch) {
        specificDate = new Date(currentYear, 4, parseInt(mayMatch[1]));
      } else if (junMatch) {
        specificDate = new Date(currentYear, 5, parseInt(junMatch[1]));
      } else if (julMatch) {
        specificDate = new Date(currentYear, 6, parseInt(julMatch[1]));
      } else if (augMatch) {
        specificDate = new Date(currentYear, 7, parseInt(augMatch[1]));
      } else if (sepMatch) {
        specificDate = new Date(currentYear, 8, parseInt(sepMatch[1]));
      } else if (octMatch) {
        specificDate = new Date(currentYear, 9, parseInt(octMatch[1]));
      } else if (novMatch) {
        specificDate = new Date(currentYear, 10, parseInt(novMatch[1]));
      }
      
      if (specificDate) {
        console.log(`Parsed specific date: ${specificDate.toISOString()}`);
        startDate = specificDate.toISOString().split('T')[0];
        endDate = startDate; // Same day for specific date queries
      } else {
        // Default: today to next week
        startDate = new Date().toISOString().split('T')[0];
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      console.log(`Querying schedules from ${startDate} to ${endDate}`);
      
      // First get schedules in date range
      const { data: schedules, error: schedError } = await supabase
        .from('production_schedules')
        .select('id, schedule_date, status')
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date', { ascending: true });
      
      if (schedError) {
        console.error('Error fetching schedules:', schedError);
      } else if (schedules && schedules.length > 0) {
        console.log(`Found ${schedules.length} schedules`);
        
        // Get schedule items for these schedules
        const scheduleIds = schedules.map((s: any) => s.id);
        
        const { data: scheduleItems, error: itemsError } = await supabase
          .from('production_schedule_items')
          .select(`
            id,
            schedule_id,
            formula_id,
            formula_code,
            batches,
            total_required_kg,
            current_stage,
            formulas (
              name,
              code,
              default_batch_size_kg
            )
          `)
          .in('schedule_id', scheduleIds);
        
        if (itemsError) {
          console.error('Error fetching schedule items:', itemsError);
        } else if (scheduleItems) {
          console.log(`Found ${scheduleItems.length} schedule items`);
          
          // Map schedule dates to items
          const scheduleMap = new Map(schedules.map((s: any) => [s.id, s]));
          
          context.upcomingSchedule = scheduleItems.map((item: any) => {
            const schedule = scheduleMap.get(item.schedule_id);
            return {
              date: schedule?.schedule_date,
              scheduleStatus: schedule?.status,
              batches: item.batches,
              totalKg: item.total_required_kg,
              currentStage: item.current_stage,
              formula: item.formulas?.name || item.formula_code || 'Unknown',
              formulaCode: item.formulas?.code || item.formula_code
            };
          }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
      }
    }
    
    // Fetch order data
    if (containsKeywords(question, ORDER_KEYWORDS)) {
      console.log('Fetching order data...');
      
      // Check for specific PO number
      const poMatch = question.match(/po\s*#?\s*(\d+)/i) || question.match(/(\d{4,})/);
      
      if (poMatch) {
        const poNumber = poMatch[1];
        console.log(`Searching for PO: ${poNumber}`);
        
        const { data: orders, error } = await supabase
          .from('order_headers')
          .select(`
            id,
            po_number,
            due_date,
            status,
            created_at,
            customers (
              company_name
            ),
            order_line_items (
              bottles_ordered,
              bottle_size,
              formulas (
                name,
                code
              )
            )
          `)
          .ilike('po_number', `%${poNumber}%`)
          .limit(5);
        
        if (error) {
          console.error('Error fetching orders by PO:', error);
        } else if (orders && orders.length > 0) {
          context.matchingOrders = orders;
          console.log(`Found ${orders.length} matching orders`);
        }
      }
      
      // Get recent/pending orders
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('order_headers')
        .select(`
          id,
          po_number,
          due_date,
          status,
          customers (
            company_name
          )
        `)
        .in('status', ['pending', 'materials_checked', 'scheduled', 'in_production'])
        .order('due_date', { ascending: true })
        .limit(10);
      
      if (pendingError) {
        console.error('Error fetching pending orders:', pendingError);
      } else if (pendingOrders) {
        context.pendingOrders = pendingOrders;
        console.log(`Found ${pendingOrders.length} pending orders`);
      }
    }
    
    // Fetch formula data for capacity calculations
    if (containsKeywords(question, FORMULA_KEYWORDS) || lowerQuestion.includes('can make') || lowerQuestion.includes('how many')) {
      console.log('Fetching formula data...');
      
      const { data: formulas, error } = await supabase
        .from('formulas')
        .select(`
          id,
          name,
          code,
          default_batch_size_kg,
          formula_ingredients (
            percentage,
            raw_materials (
              id,
              name
            )
          )
        `)
        .eq('is_deleted', false)
        .limit(20);
      
      if (error) {
        console.error('Error fetching formulas:', error);
      } else if (formulas) {
        context.formulas = formulas.map((f: any) => ({
          name: f.name,
          code: f.code,
          batchSizeKg: f.default_batch_size_kg,
          ingredients: f.formula_ingredients?.map((ing: any) => ({
            name: ing.raw_materials?.name,
            percentage: ing.percentage,
            kgPerBatch: (ing.percentage / 100) * f.default_batch_size_kg
          }))
        }));
        console.log(`Found ${formulas.length} formulas`);
      }
    }
    
  } catch (error) {
    console.error('Error gathering context:', error);
  }
  
  console.log('Final context keys:', Object.keys(context));
  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - please log in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    
    const { message, conversationHistory = [] } = await req.json();
    
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client using the user's JWT - this respects RLS policies
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(JSON.stringify({ error: "Authentication failed - please log in again" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.email}`);

    // Gather relevant context from database
    console.log('Gathering context for question:', message);
    const context = await gatherContext(supabase, message);
    console.log('Context gathered:', JSON.stringify(context).slice(0, 1000));

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `You are ERP.ai Assistant, an AI helper for a gummy manufacturing ERP system called ERP.ai.

Current date: ${today}

You have access to real-time data from the ERP.ai database. Here is the relevant context for this question:

${JSON.stringify(context, null, 2)}

CRITICAL INSTRUCTIONS:
- The "searchedMaterials" array contains materials that MATCHED the user's search query. If there are results here, USE THEM - they are what the user is asking about.
- For inventory questions: Calculate the TOTAL quantity by summing the "quantity" field across ALL lots in "raw_material_lots" for each material
- Example: If a material has lots with quantities [0, 0, 7984, 19159, 0], the total is 27,143 kg
- Always include specific numbers and quantities (in kg) when reporting inventory
- If searchedMaterials has results, DO NOT say "I don't have information" - those ARE the search results!
- If searchedMaterials is empty AND allMaterials doesn't help, THEN say you don't have the information
- Format responses cleanly with bullet points for lists
- Be concise but complete - always report the calculated totals
- DO NOT make up or invent data - only use what's in the context above

AVAILABLE DATA:
- searchedMaterials: Materials matching the user's query with lot-level details (id, lot_number, quantity, cost, expires_on)
- allMaterials: Summary of all materials with total quantities
- upcomingSchedule: Production schedule with dates, batches, formulas
- pendingOrders: Active orders in progress
- matchingOrders: Orders matching a specific PO search
- formulas: Recipe information with ingredients and batch sizes`;

    // Build messages array with conversation history.
    // Anthropic takes the system prompt as a separate field (not a message),
    // and requires roles to be only "user"/"assistant".
    const history = (conversationHistory as Array<{ role: string; content: string }>)
      .slice(-10)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const messages = [
      ...history,
      { role: "user" as const, content: message },
    ];

    console.log('Calling Claude...');
    const response = await callAnthropicStream({
      model: MODELS.default,
      system: systemPrompt,
      maxTokens: 2048,
      messages,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI provider error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate Anthropic's SSE stream into the OpenAI-style
    // `data: {choices:[{delta:{content}}]}` format the frontend already parses.
    const translated = anthropicStreamToOpenAI(response.body!);

    // Stream the response back to the client
    return new Response(translated, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("Error in erp-assistant function:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
