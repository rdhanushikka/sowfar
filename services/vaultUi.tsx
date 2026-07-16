import React, { createContext, useContext } from 'react';

// Lets the vault setup/unlock screens tell the root layout the journal is open.
interface VaultUi {
  onUnlocked: () => void;
  onReset: () => void;
}

export const VaultUiContext = createContext<VaultUi>({
  onUnlocked: () => {},
  onReset: () => {},
});
export const useVaultUi = () => useContext(VaultUiContext);
