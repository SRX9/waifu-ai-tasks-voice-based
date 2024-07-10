export interface HeadlineSection {
  type: "headline";
  content: string;
}

export interface SubheadlineSection {
  type: "subheadline";
  content: string;
}

export interface ArticleSection {
  type: "article";
  title: string;
  author: string;
  content: string;
}

export interface FeaturedImageSection {
  type: "featured_image";
  url: string;
  caption: string;
}

export interface InfographicSection {
  type: "infographic";
  title: string;
  data: Record<string, number>;
  description: string;
}

export interface SidebarSection {
  type: "sidebar";
  content: string;
}

export type Section =
  | HeadlineSection
  | SubheadlineSection
  | ArticleSection
  | FeaturedImageSection
  | InfographicSection
  | SidebarSection;

export interface Page {
  page: number;
  title: string;
  sections: Section[];
}

export interface Newspaper {
  title: string;
  date: string;
  pages: Page[];
}
