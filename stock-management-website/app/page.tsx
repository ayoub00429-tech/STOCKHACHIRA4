"use client"

import { DialogTrigger } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Search, Plus, Check, X, Package, Filter, Trash2, AlertTriangle, History, Pencil, Hash } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getSupabaseClient } from "@/lib/supabase"

type StockLog = {
  id: string
  product_id: string
  product_name: string
  product_reference: string
  previous_quantity: number
  new_quantity: number
  change: number
  created_at: string
}

type RestockLog = {
  id: string
  product_id: string
  product_name: string
  product_reference: string
  out_of_stock_date: string
  restocked: boolean
  restock_date: string | null
  restock_quantity: number | null
  created_at: string
}

type Product = {
  id: string
  name: string
  description: string
  reference: string
  category: string
  buying_price: number
  quantity: number
  created_at: string
  updated_at: string
}

type NewProduct = Omit<Product, "id" | "created_at" | "updated_at">

export default function InventoryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [categories, setCategories] = useState<string[]>([])
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState(false)
  const [isStockLogOpen, setIsStockLogOpen] = useState(false)
  const [isRestockLogOpen, setIsRestockLogOpen] = useState(false)
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [restockLogs, setRestockLogs] = useState<RestockLog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState<number>(0)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [customCategory, setCustomCategory] = useState("")
  const [loading, setLoading] = useState(true)

  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: "",
    description: "",
    reference: "",
    category: "",
    buying_price: 0,
    quantity: 0,
  })

  const supabase = getSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadCategories(), loadProducts(), loadStockLogs(), loadRestockLogs()])
    setLoading(false)
  }

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("name").order("name")
    if (!error && data) {
      setCategories(data.map((c) => c.name))
    }
  }

  const loadProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })
    if (!error && data) {
      setProducts(data)
    }
  }

  const loadStockLogs = async () => {
    const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false })
    if (!error && data) {
      setStockLogs(data)
    }
  }

  const loadRestockLogs = async () => {
    const { data, error } = await supabase.from("restock_logs").select("*").order("created_at", { ascending: false })
    if (!error && data) {
      setRestockLogs(data)
    }
  }

  const addProduct = async () => {
    if (newProduct.name && newProduct.reference) {
      const { data, error } = await supabase.from("products").insert([newProduct]).select().single()

      if (!error && data) {
        setProducts([data, ...products])
        setIsAddDialogOpen(false)
        setNewProduct({
          name: "",
          description: "",
          reference: "",
          category: "",
          buying_price: 0,
          quantity: 0,
        })
      }
    }
  }

  const startEditQuantity = (product: Product) => {
    setEditingId(product.id)
    setEditQuantity(product.quantity)
    setEditingProduct(product)
  }

  const saveQuantity = async () => {
    if (editingProduct && editQuantity !== editingProduct.quantity) {
      // Log stock movement
      await addStockLog(
        editingProduct.id,
        editingProduct.name,
        editingProduct.reference,
        editingProduct.quantity,
        editQuantity,
      )

      // Check for restock
      if (editingProduct.quantity === 0 && editQuantity > 0) {
        await markAsRestocked(editingProduct.id, editQuantity)
      } else if (editQuantity === 0 && editingProduct.quantity > 0) {
        await supabase.from("restock_logs").insert([
          {
            product_id: editingProduct.id,
            product_name: editingProduct.name,
            product_reference: editingProduct.reference,
            out_of_stock_date: new Date().toISOString(),
            restocked: false,
          },
        ])
        await loadRestockLogs()
      }

      // Update product quantity
      const { data, error } = await supabase
        .from("products")
        .update({ quantity: editQuantity, updated_at: new Date().toISOString() })
        .eq("id", editingProduct.id)
        .select()
        .single()

      if (!error && data) {
        setProducts(products.map((p) => (p.id === editingProduct.id ? data : p)))
      }
    }
    setEditingId(null)
    setEditingProduct(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuantity(0)
    setEditingProduct(null)
  }

  const handleEditProduct = async () => {
    if (editingProduct && editingProduct.name && editingProduct.reference) {
      const oldProduct = products.find((p) => p.id === editingProduct.id)

      if (oldProduct && oldProduct.quantity !== editingProduct.quantity) {
        await addStockLog(
          editingProduct.id,
          editingProduct.name,
          editingProduct.reference,
          oldProduct.quantity,
          editingProduct.quantity,
        )
      }

      const { data, error } = await supabase
        .from("products")
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          reference: editingProduct.reference,
          category: editingProduct.category,
          buying_price: editingProduct.buying_price,
          quantity: editingProduct.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id)
        .select()
        .single()

      if (!error && data) {
        setProducts(products.map((p) => (p.id === editingProduct.id ? data : p)))
        setIsEditDialogOpen(false)
        setEditingProduct(null)
      }
    }
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct({ ...product })
    setIsEditDialogOpen(true)
  }

  const handleAddCategory = async () => {
    if (customCategory.trim() && !categories.includes(customCategory.trim())) {
      const newCat = customCategory.trim()

      const { error } = await supabase.from("categories").insert([{ name: newCat }])

      if (!error) {
        setCategories([...categories, newCat])
        if (isAddingCategory && editingProduct) {
          setEditingProduct({ ...editingProduct, category: newCat })
        } else if (isAddingCategory) {
          setNewProduct({ ...newProduct, category: newCat })
        }
        setCustomCategory("")
        setIsAddingCategory(false)
      }
    }
  }

  const handleDeleteCategory = async (categoryToDelete: string) => {
    const productsInCategory = products.filter((p) => p.category === categoryToDelete)
    if (productsInCategory.length > 0) {
      alert(
        `Cannot delete category "${categoryToDelete}" because ${productsInCategory.length} product(s) are using it.`,
      )
      return
    }

    const { error } = await supabase.from("categories").delete().eq("name", categoryToDelete)

    if (!error) {
      setCategories(categories.filter((c) => c !== categoryToDelete))
      if (selectedCategory === categoryToDelete) {
        setSelectedCategory("all")
      }
    }
  }

  const handleAddNewCategory = async () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      const { error } = await supabase.from("categories").insert([{ name: newCategoryName.trim() }])

      if (!error) {
        setCategories([...categories, newCategoryName.trim()])
        setNewCategoryName("")
      }
    }
  }

  const addStockLog = async (
    productId: string,
    productName: string,
    reference: string,
    prevQty: number,
    newQty: number,
  ) => {
    const { data, error } = await supabase
      .from("stock_movements")
      .insert([
        {
          product_id: productId,
          product_name: productName,
          product_reference: reference,
          previous_quantity: prevQty,
          new_quantity: newQty,
          change: newQty - prevQty,
        },
      ])
      .select()
      .single()

    if (!error && data) {
      setStockLogs([data, ...stockLogs])
    }
  }

  const markAsRestocked = async (productId: string, newQuantity: number) => {
    const { error } = await supabase
      .from("restock_logs")
      .update({
        restocked: true,
        restock_date: new Date().toISOString(),
        restock_quantity: newQuantity,
      })
      .eq("product_id", productId)
      .eq("restocked", false)

    if (!error) {
      await loadRestockLogs()
    }
  }

  const handleQuickRestock = async (product: Product) => {
    const quantity = prompt(`Restock quantity for ${product.name}:`)
    if (quantity && !isNaN(Number(quantity)) && Number(quantity) > 0) {
      const newQuantity = Number(quantity)

      await addStockLog(product.id, product.name, product.reference, product.quantity, newQuantity)

      const { data, error } = await supabase
        .from("products")
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq("id", product.id)
        .select()
        .single()

      if (!error && data) {
        setProducts(products.map((p) => (p.id === product.id ? data : p)))
        await markAsRestocked(product.id, newQuantity)
      }
    }
  }

  const filteredProducts =
    selectedCategory === "all"
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.reference.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : products.filter(
          (product) =>
            product.category === selectedCategory &&
            (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.reference.toLowerCase().includes(searchTerm.toLowerCase())),
        )

  const outOfStockProducts = products.filter((product) => product.quantity === 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading inventory...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">HACHIRA PA - Stock Management</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsRestockLogOpen(true)} className="gap-2">
                <Package className="h-4 w-4" />
                Restock Log
              </Button>
              <Button variant="outline" onClick={() => setIsStockLogOpen(true)} className="gap-2">
                <History className="h-4 w-4" />
                Stock Log
              </Button>
              <Button variant="outline" onClick={() => setIsOutOfStockOpen(true)} className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Out of Stock ({outOfStockProducts.length})
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, reference, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {selectedCategory === "all" ? "All Categories" : selectedCategory}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedCategory("all")}>All Categories</DropdownMenuItem>
              {categories.map((cat) => (
                <DropdownMenuItem key={cat} onClick={() => setSelectedCategory(cat)}>
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            Manage Categories
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Enter the details of the new auto part to add to inventory</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name*</Label>
                  <Input
                    id="name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g., Brake Pads Set"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Product description..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reference">Reference*</Label>
                  <Input
                    id="reference"
                    value={newProduct.reference}
                    onChange={(e) => setNewProduct({ ...newProduct, reference: e.target.value })}
                    placeholder="e.g., BP-001-FR"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newProduct.category}
                    onValueChange={(value) => {
                      if (value === "__add_new__") {
                        setIsAddingCategory(true)
                      } else {
                        setNewProduct({ ...newProduct, category: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__add_new__" className="text-primary font-medium">
                        + Add New Category
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isAddingCategory && (
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="New category name"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddCategory()
                          if (e.key === "Escape") {
                            setIsAddingCategory(false)
                            setCustomCategory("")
                          }
                        }}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleAddCategory}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingCategory(false)
                          setCustomCategory("")
                        }}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Buying Price*</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={newProduct.buying_price}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, buying_price: Number.parseFloat(e.target.value) })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity*</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newProduct.quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, quantity: Number.parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addProduct}>Add Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Products</p>
            <p className="text-2xl font-bold text-foreground">{products.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Items in Stock</p>
            <p className="text-2xl font-bold text-foreground">
              {filteredProducts.reduce((sum, p) => sum + p.quantity, 0)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Inventory Value</p>
            <p className="text-2xl font-bold text-foreground">
              ${filteredProducts.reduce((sum, p) => sum + p.buying_price * p.quantity, 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Buying Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{product.description}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{product.reference}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">${product.buying_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {editingId === product.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number.parseInt(e.target.value) || 0)}
                            className="w-20"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQuantity()
                              if (e.key === "Escape") cancelEdit()
                            }}
                          />
                          <Button size="icon" variant="ghost" onClick={saveQuantity}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <span className={product.quantity < 10 ? "text-red-600 font-bold" : ""}>
                          {product.quantity}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditQuantity(product)}
                          className="h-8 w-8"
                          title="Quick Edit Quantity"
                        >
                          <Hash className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                          className="h-8 w-8"
                          title="Edit Product"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Product Name*</Label>
                <Input
                  id="edit-name"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-reference">Reference*</Label>
                <Input
                  id="edit-reference"
                  value={editingProduct.reference}
                  onChange={(e) => setEditingProduct({ ...editingProduct, reference: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editingProduct.category}
                  onValueChange={(value) => {
                    if (value === "__add_new__") {
                      setIsAddingCategory(true)
                    } else {
                      setEditingProduct({ ...editingProduct, category: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      + Add New Category
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isAddingCategory && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="New category name"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory()
                        if (e.key === "Escape") {
                          setIsAddingCategory(false)
                          setCustomCategory("")
                        }
                      }}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={handleAddCategory}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingCategory(false)
                        setCustomCategory("")
                      }}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price">Buying Price*</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editingProduct.buying_price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, buying_price: Number.parseFloat(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-quantity">Quantity*</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    value={editingProduct.quantity}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, quantity: Number.parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add or remove product categories</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNewCategory()}
              />
              <Button onClick={handleAddNewCategory}>Add</Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-2 border rounded">
                  <span>{cat}</span>
                  <Button size="icon" variant="ghost" onClick={() => handleDeleteCategory(cat)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Out of Stock Sheet */}
      <Sheet open={isOutOfStockOpen} onOpenChange={setIsOutOfStockOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Out of Stock Items</SheetTitle>
            <SheetDescription>Products that need restocking</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {outOfStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No items out of stock</p>
            ) : (
              outOfStockProducts.map((product) => (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>
                      <div className="space-y-1">
                        <div>
                          <strong>Reference:</strong> {product.reference}
                        </div>
                        <div>
                          <strong>Description:</strong> {product.description}
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" onClick={() => handleQuickRestock(product)}>
                      Restock Item
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Stock Log Sheet */}
      <Sheet open={isStockLogOpen} onOpenChange={setIsStockLogOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Stock Movement Log</SheetTitle>
            <SheetDescription>History of all stock quantity changes</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {stockLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No stock movements yet</p>
            ) : (
              stockLogs.map((log) => (
                <Card key={log.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{log.product_name}</CardTitle>
                    <CardDescription>Ref: {log.product_reference}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Previous:</span>
                      <span className="font-medium">{log.previous_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New:</span>
                      <span className="font-medium">{log.new_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Change:</span>
                      <span className={log.change > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {log.change > 0 ? "+" : ""}
                        {log.change}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Date:</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Restock Log Sheet */}
      <Sheet open={isRestockLogOpen} onOpenChange={setIsRestockLogOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Restock Log</SheetTitle>
            <SheetDescription>Products that went out of stock and their restock status</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {restockLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No restock events yet</p>
            ) : (
              restockLogs.map((log) => (
                <Card key={log.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{log.product_name}</CardTitle>
                        <CardDescription>Ref: {log.product_reference}</CardDescription>
                      </div>
                      <Badge variant={log.restocked ? "default" : "destructive"}>
                        {log.restocked ? "Restocked" : "Out of Stock"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Went out of stock:</span>
                      <span className="text-xs">{new Date(log.out_of_stock_date).toLocaleString()}</span>
                    </div>
                    {log.restocked && log.restock_date && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Restocked on:</span>
                          <span className="text-xs">{new Date(log.restock_date).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantity added:</span>
                          <span className="font-medium text-green-600">{log.restock_quantity}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
