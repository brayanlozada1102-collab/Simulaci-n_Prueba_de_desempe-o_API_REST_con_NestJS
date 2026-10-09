export default () => ({
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  apiKeys: (process.env.API_KEYS ?? 'clave_secreta_comercial_1,clave_secreta_comercial_2,empresa_key_3')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
  database: {
    type: process.env.DB_TYPE ?? 'sqlite',
    sqlitePath: process.env.SQLITE_DATABASE ?? 'commercialization.sqlite',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '', 10) || 5432,
    username: process.env.POSTGRES_USER ?? 'test',
    password: process.env.POSTGRES_PASSWORD ?? 'test',
    name: process.env.POSTGRES_DB ?? 'riwi_commercialization',
  },
});