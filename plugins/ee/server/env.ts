import { IsBoolean, IsOptional, MaxLength } from "class-validator";
import { Environment } from "@server/env";
import { Public } from "@server/utils/decorators/Public";
import environment from "@server/utils/environment";
import { CannotUseWithout } from "@server/utils/validators";

class EEPluginEnvironment extends Environment {
  /**
   * API key for AI answers. OpenAI-compatible providers. Server-side only.
   */
  @IsOptional()
  public AI_API_KEY =
    this.toOptionalString(environment.AI_API_KEY) ??
    this.toOptionalString(environment.XAI_API_KEY);

  /**
   * Chat completions base URL, including version path. Defaults to xAI.
   */
  public AI_API_BASE_URL = (
    this.toOptionalString(environment.AI_API_BASE_URL) ?? "https://api.x.ai/v1"
  ).replace(/\/+$/, "");

  /**
   * Model id sent to the provider. Defaults to grok-4.5.
   */
  public AI_MODEL = environment.AI_MODEL ?? environment.XAI_MODEL ?? "grok-4.5";

  /**
   * Embedding API base URL, including version path. Separate from chat completions.
   * Leave unset to disable vector indexing.
   */
  @IsOptional()
  public AI_EMBEDDING_API_BASE_URL = (
    this.toOptionalString(environment.AI_EMBEDDING_API_BASE_URL) ?? ""
  ).replace(/\/+$/, "");

  /**
   * API key for embeddings. Falls back to AI_API_KEY when omitted.
   */
  @IsOptional()
  public AI_EMBEDDING_API_KEY = this.toOptionalString(
    environment.AI_EMBEDDING_API_KEY
  );

  /**
   * Embedding model for vector retrieval. OpenAI-compatible /v1/embeddings.
   * Leave unset to skip indexing; chat answers still work with keyword search.
   */
  @IsOptional()
  public AI_EMBEDDING_MODEL = this.toOptionalString(
    environment.AI_EMBEDDING_MODEL
  );

  get embeddingApiKey() {
    return this.AI_EMBEDDING_API_KEY || this.AI_API_KEY;
  }

  get embeddingApiBaseUrl() {
    return this.AI_EMBEDDING_API_BASE_URL;
  }

  /**
   * Rerank API base URL, including version path. Optional; used after retrieval.
   */
  @IsOptional()
  public AI_RERANK_API_BASE_URL = (
    this.toOptionalString(environment.AI_RERANK_API_BASE_URL) ?? ""
  ).replace(/\/+$/, "");

  /**
   * API key for rerank. Falls back to embedding key, then chat key.
   */
  @IsOptional()
  public AI_RERANK_API_KEY = this.toOptionalString(environment.AI_RERANK_API_KEY);

  /**
   * Rerank model id. Leave unset to skip reranking.
   */
  @IsOptional()
  public AI_RERANK_MODEL = this.toOptionalString(environment.AI_RERANK_MODEL);

  get rerankApiKey() {
    return this.AI_RERANK_API_KEY || this.embeddingApiKey;
  }

  get rerankApiBaseUrl() {
    return this.AI_RERANK_API_BASE_URL;
  }

  /**
   * SAML identity provider metadata URL or entity.
   */
  @IsOptional()
  @CannotUseWithout("SAML_CERT")
  public SAML_SSO_ENDPOINT = this.toOptionalString(
    environment.SAML_SSO_ENDPOINT
  );

  /**
   * PEM-encoded IdP signing certificate (without BEGIN/END lines is OK).
   */
  @IsOptional()
  @CannotUseWithout("SAML_SSO_ENDPOINT")
  public SAML_CERT = this.toOptionalString(environment.SAML_CERT);

  /**
   * Display name on the sign-in button.
   */
  @MaxLength(50)
  public SAML_DISPLAY_NAME = environment.SAML_DISPLAY_NAME ?? "SAML";

  /**
   * Attribute in the SAML assertion used as the email address.
   */
  public SAML_EMAIL_ATTRIBUTE =
    environment.SAML_EMAIL_ATTRIBUTE ??
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";

  /**
   * Attribute in the SAML assertion used as the display name.
   */
  public SAML_USERNAME_ATTRIBUTE =
    environment.SAML_USERNAME_ATTRIBUTE ??
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

  /**
   * Disable auto-redirect to SAML when it is the only auth method.
   */
  @Public
  @IsOptional()
  @IsBoolean()
  public SAML_DISABLE_REDIRECT = this.toOptionalBoolean(
    environment.SAML_DISABLE_REDIRECT
  );
}

export default new EEPluginEnvironment();
