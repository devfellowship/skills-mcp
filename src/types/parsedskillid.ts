export interface ParsedSkillId {
  owner: string;
  repo: string;
  /** Present only when the id had three segments. */
  slug?: string;
}
