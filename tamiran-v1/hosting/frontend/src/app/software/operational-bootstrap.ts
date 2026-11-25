export type OperationalBootstrapLoaders<
  TFollowUps,
  TOperations,
  TCatalog,
  TSettings,
  TCapabilities,
> = {
  loadFollowUps: () => Promise<TFollowUps>;
  loadOperations: () => Promise<TOperations>;
  loadCatalog: () => Promise<TCatalog>;
  loadShopSettings: () => Promise<TSettings>;
  loadCapabilities: () => Promise<TCapabilities>;
};

export type OperationalBootstrapCore<
  TOperations,
  TCatalog,
  TSettings,
  TCapabilities,
> = {
  operations: TOperations;
  catalog: TCatalog;
  settings: TSettings;
  capabilities: TCapabilities;
};

function invoke<T>(loader: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(loader);
}

export async function loadOperationalBootstrap<
  TFollowUps,
  TOperations,
  TCatalog,
  TSettings,
  TCapabilities,
>(
  loaders: OperationalBootstrapLoaders<
    TFollowUps,
    TOperations,
    TCatalog,
    TSettings,
    TCapabilities
  >,
): Promise<{
  core: PromiseSettledResult<
    OperationalBootstrapCore<
      TOperations,
      TCatalog,
      TSettings,
      TCapabilities
    >
  >;
  followUps: PromiseSettledResult<TFollowUps>;
}> {
  const corePromise = Promise.all([
    invoke(loaders.loadOperations),
    invoke(loaders.loadCatalog),
    invoke(loaders.loadShopSettings),
    invoke(loaders.loadCapabilities),
  ]).then(([operations, catalog, settings, capabilities]) => ({
    operations,
    catalog,
    settings,
    capabilities,
  }));

  const [core, followUps] = await Promise.allSettled([
    corePromise,
    invoke(loaders.loadFollowUps),
  ]);
  return { core, followUps };
}
