import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import {
  RefreshCw,
  Package,
  DollarSign,
  Check,
  X,
  Save,
  AlertTriangle,
  Filter,
  Loader2,
} from "lucide-react";

type PlantStockRow = {
  id: string;
  plant_id: string;
  quantity: number;
  price: number;
  is_available: boolean;
  updated_at: string;
  plant_name: string;
  plant_status: string;
  plant_image: string | null;
};

export const AdminStocksPanel: React.FC = () => {
  const { user } = useAuth();
  const [stocks, setStocks] = React.useState<PlantStockRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [initialized, setInitialized] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showOnlyAvailable, setShowOnlyAvailable] = React.useState(true);
  
  // Track which rows are being edited
  const [editingRows, setEditingRows] = React.useState<Record<string, { quantity: number; price: number; is_available: boolean }>>({});
  const [savingRows, setSavingRows] = React.useState<Set<string>>(new Set());

  const loadStocks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all plants (any status) for stock management
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id, name, status, plant_images(link, use)")
        .order("name");

      if (plantsError) throw new Error(plantsError.message);

      // Then get existing stock records
      const { data: existingStocks, error: stocksError } = await supabase
        .from("plant_stocks")
        .select("*");

      if (stocksError) throw new Error(stocksError.message);

      // Create a map of existing stocks by plant_id
      type StockRecord = {
        id: string;
        plant_id: string;
        quantity: number;
        price: number;
        is_available: boolean;
        updated_at: string;
      };
      const stocksMap = new Map<string, StockRecord>();
      (existingStocks || []).forEach((s) => {
        stocksMap.set(s.plant_id, s as StockRecord);
      });

      // Merge plants with their stock info
      type PlantRecord = {
        id: string;
        name: string;
        status?: string;
        plant_images?: Array<{ link: string; use: string }>;
      };
      const merged: PlantStockRow[] = (plants || []).map((plant: PlantRecord) => {
        const stock = stocksMap.get(plant.id);
        const primaryImage = plant.plant_images?.find((img) => img.use === "primary")?.link ||
          plant.plant_images?.[0]?.link || null;
        
        return {
          id: stock?.id || `new-${plant.id}`,
          plant_id: plant.id,
          quantity: stock?.quantity ?? 0,
          price: stock?.price ?? 0,
          is_available: stock?.is_available ?? false,
          updated_at: stock?.updated_at || "",
          plant_name: plant.name,
          plant_status: plant.status || "unknown",
          plant_image: primaryImage,
        };
      });

      setStocks(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  React.useEffect(() => {
    if (!initialized) {
      loadStocks();
    }
  }, [initialized, loadStocks]);

  const filteredStocks = React.useMemo(() => {
    let result = stocks;
    
    // Apply availability filter
    if (showOnlyAvailable) {
      result = result.filter((s) => s.is_available);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((s) => s.plant_name.toLowerCase().includes(query));
    }
    
    return result;
  }, [stocks, showOnlyAvailable, searchQuery]);

  const startEditing = (row: PlantStockRow) => {
    setEditingRows((prev) => ({
      ...prev,
      [row.plant_id]: {
        quantity: row.quantity,
        price: row.price,
        is_available: row.is_available,
      },
    }));
  };

  const cancelEditing = (plantId: string) => {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[plantId];
      return next;
    });
  };

  const updateEditingField = (plantId: string, field: "quantity" | "price" | "is_available", value: number | boolean) => {
    setEditingRows((prev) => ({
      ...prev,
      [plantId]: {
        ...prev[plantId],
        [field]: value,
      },
    }));
  };

  const saveRow = async (row: PlantStockRow) => {
    const edits = editingRows[row.plant_id];
    if (!edits || !user?.id) return;

    setSavingRows((prev) => new Set(prev).add(row.plant_id));
    setError(null);

    try {
      const isNewRecord = row.id.startsWith("new-");
      
      if (isNewRecord) {
        // Insert new stock record
        const { error: insertError } = await supabase
          .from("plant_stocks")
          .insert({
            plant_id: row.plant_id,
            quantity: edits.quantity,
            price: edits.price,
            is_available: edits.is_available,
            updated_by: user.id,
          });

        if (insertError) throw new Error(insertError.message);
      } else {
        // Update existing stock record
        const { error: updateError } = await supabase
          .from("plant_stocks")
          .update({
            quantity: edits.quantity,
            price: edits.price,
            is_available: edits.is_available,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("id", row.id);

        if (updateError) throw new Error(updateError.message);
      }

      // Update local state
      setStocks((prev) =>
        prev.map((s) =>
          s.plant_id === row.plant_id
            ? {
                ...s,
                quantity: edits.quantity,
                price: edits.price,
                is_available: edits.is_available,
                updated_at: new Date().toISOString(),
              }
            : s
        )
      );

      cancelEditing(row.plant_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSavingRows((prev) => {
        const next = new Set(prev);
        next.delete(row.plant_id);
        return next;
      });
    }
  };

  const availableCount = React.useMemo(() => stocks.filter((s) => s.is_available).length, [stocks]);
  const totalCount = stocks.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
            Plant Stocks
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Manage plant availability, quantity, and pricing for the shop
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-stone-500 dark:text-stone-400">Available</div>
              <div className="text-xl font-bold text-stone-900 dark:text-white">{availableCount}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-stone-500 dark:text-stone-400">Total Plants</div>
              <div className="text-xl font-bold text-stone-900 dark:text-white">{totalCount}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-stone-500 dark:text-stone-400">Unavailable</div>
              <div className="text-xl font-bold text-stone-900 dark:text-white">{totalCount - availableCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plants..."
                className="rounded-xl flex-1 sm:w-64"
              />
              <Button
                variant={showOnlyAvailable ? "default" : "outline"}
                size="sm"
                className="rounded-xl whitespace-nowrap"
                onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showOnlyAvailable ? "Available Only" : "Show All"}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={loadStocks}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Table */}
          {loading && !initialized ? (
            <div className="flex items-center justify-center py-8 text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading stocks...
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="text-center py-8 text-stone-500 dark:text-stone-400">
              {searchQuery.trim() || showOnlyAvailable
                ? "No plants match your filters."
                : "No plants found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-[#3e3e42]">
                    <th className="text-left py-3 px-2 font-medium text-stone-600 dark:text-stone-300">Plant</th>
                    <th className="text-center py-3 px-2 font-medium text-stone-600 dark:text-stone-300 w-24">Available</th>
                    <th className="text-center py-3 px-2 font-medium text-stone-600 dark:text-stone-300 w-28">Quantity</th>
                    <th className="text-center py-3 px-2 font-medium text-stone-600 dark:text-stone-300 w-28">Price (€)</th>
                    <th className="text-center py-3 px-2 font-medium text-stone-600 dark:text-stone-300 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                  {filteredStocks.map((row) => {
                    const isEditing = !!editingRows[row.plant_id];
                    const isSaving = savingRows.has(row.plant_id);
                    const edits = editingRows[row.plant_id];

                    return (
                      <tr key={row.plant_id} className="hover:bg-stone-50 dark:hover:bg-[#252528]">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            {row.plant_image ? (
                              <img
                                src={row.plant_image}
                                alt={row.plant_name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center">
                                <Package className="h-5 w-5 text-stone-400" />
                              </div>
                            )}
                                    <div className="flex flex-col">
                              <span className="font-medium text-stone-900 dark:text-white truncate max-w-[200px]">
                                {row.plant_name}
                              </span>
                              <span className={`text-xs capitalize ${
                                row.plant_status === "approved" ? "text-emerald-600 dark:text-emerald-400" :
                                row.plant_status === "review" ? "text-amber-600 dark:text-amber-400" :
                                row.plant_status === "rework" ? "text-rose-600 dark:text-rose-400" :
                                "text-stone-400"
                              }`}>
                                {row.plant_status === "in progres" ? "In Progress" : row.plant_status}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => updateEditingField(row.plant_id, "is_available", !edits.is_available)}
                              className={`mx-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                edits.is_available
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-400"
                              }`}
                            >
                              {edits.is_available ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </button>
                          ) : (
                            <Badge
                              variant={row.is_available ? "default" : "secondary"}
                              className={`${
                                row.is_available
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-stone-100 text-stone-500 dark:bg-[#2a2a2d] dark:text-stone-400"
                              }`}
                            >
                              {row.is_available ? "Yes" : "No"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              value={edits.quantity}
                              onChange={(e) => updateEditingField(row.plant_id, "quantity", Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-20 h-8 text-center rounded-lg mx-auto"
                            />
                          ) : (
                            <span className="text-stone-700 dark:text-stone-200">{row.quantity}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edits.price}
                              onChange={(e) => updateEditingField(row.plant_id, "price", Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-20 h-8 text-center rounded-lg mx-auto"
                            />
                          ) : (
                            <span className="text-stone-700 dark:text-stone-200">
                              {row.price > 0 ? `€${row.price.toFixed(2)}` : "-"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => saveRow(row)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-[#2a2a2d]"
                                onClick={() => cancelEditing(row.plant_id)}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
                              onClick={() => startEditing(row)}
                            >
                              Edit
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Results count */}
          {filteredStocks.length > 0 && (
            <div className="text-xs text-stone-500 dark:text-stone-400 pt-2">
              Showing {filteredStocks.length} of {totalCount} plants
              {showOnlyAvailable && ` (${availableCount} available)`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
