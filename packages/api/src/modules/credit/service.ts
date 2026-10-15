import { MedusaService } from "@medusajs/framework/utils"

import CreditBalance from "./models/credit-balance"
import CreditLedgerEntry from "./models/credit-ledger-entry"

class CreditModuleService extends MedusaService({
  CreditBalance,
  CreditLedgerEntry,
}) {}

export default CreditModuleService
