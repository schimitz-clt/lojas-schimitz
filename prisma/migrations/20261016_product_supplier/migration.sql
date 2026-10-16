-- Prime: fornecedor e custo por produto (aditiva; tabela separada para nunca vazar na vitrine pública).
CREATE TABLE "ProductSupplier" (
    "productId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierSku" TEXT,
    "supplierUrl" TEXT,
    "costPrice" DECIMAL(12,2),
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("productId")
);

ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
