import { fetchWithTimeout } from "@/lib/apiUtil";
import { cleanSourceText, cleanURLForUserView } from "@/lib/text";
import { extractLinksFromText } from "@/lib/utils";
import axios from "axios";
import * as cheerio from "cheerio";

export enum ESearchEngines {
  SERPER_DEV = "SERPER_DEV",
  BING = "BING",
  GOOGLE_API = "GOOGLE_API",
  BING_API = "BING_API",
  BRAVE = "BRAVE",
}

export function extractMetaData($: any): any {
  const metaData: any = {};

  metaData.title =
    $('meta[property="og:title"]').attr("content") ||
    $("shreddit-title").attr("title") ||
    $("title").text() ||
    $('meta[name="title"]').attr("content");

  metaData.description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content");

  metaData.site_name = $('meta[property="og:site_name"]').attr("content");

  // Get image
  const ogImage =
    $('meta[name="og:image"]').attr("content") ||
    $('meta[property="og:image"]').attr("content");
  const twitterImage =
    $('meta[property="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  const image = ogImage || twitterImage;
  if (image) {
    metaData.image = image;
  }

  return metaData;
}

export function extractMainContent($: any): string {
  try {
    $(
      "script, style, head, nav, footer, iframe, img, meta, sidebar, header, video"
    ).remove();
    return $("body").text().replace(/\s+/g, " ").trim();
  } catch (error) {
    console.log("Error extracting main content:", error);
    throw error;
  }
}

export function extractImages($: any, limit = 2): string[] {
  const images = $("img")
    .map((_: any, el: any) => {
      const src = $(el).attr("src");
      const width = parseInt($(el).attr("width") || "0", 100);
      const height = parseInt($(el).attr("height") || "0", 100);
      return { src, width, height };
    })
    .get()
    .filter(
      (image: { src: any; width: number; height: number }) =>
        image.src && image.width > 0 && image.height > 0
    )
    .sort(
      (
        a: { width: number; height: number },
        b: { width: number; height: number }
      ) => b.width * b.height - a.width * a.height
    )
    .slice(0, limit)
    .map((image: { src: any }) => image.src);

  return images;
}

export const GetQuerySlicedCacheKey = (query: string) => {
  return cleanURLForUserView(
    query?.replace("https://", "")?.replace("http://", "")?.slice(0, 50)
  );
};

export const getSearchEngineLinks = async (
  query: string,
  searchEngine: ESearchEngines,
  queryType: string,
  location: string
) => {
  try {
    switch (searchEngine) {
      case ESearchEngines.GOOGLE_API:
        const startInitSearchEngineReqTime = performance.now();

        const googleApiKey = process.env.YOUR_GOOGLE_API_KEY;
        const googleApiUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${
          process.env.GOOGLE_CX
        }&q=${encodeURIComponent(
          query
        )}&fields=items(link)&gl=${location?.toLowerCase()}`;

        const googleResponse = await fetch(googleApiUrl);
        const data = await googleResponse.json();
        const endInitSearchEngineReqTime = performance.now();
        const timeTakenSearchEngineChecksReq =
          endInitSearchEngineReqTime - startInitSearchEngineReqTime;
        console.log(
          `SearchEngine GOOGLE API Checks Request Time taken: ${timeTakenSearchEngineChecksReq.toFixed(
            2
          )} ms`
        );

        return { links: data.items.map((item: any) => item.link) };
      case ESearchEngines.SERPER_DEV:
        const serperDevResponse = await fetch(
          `https://google.serper.dev/search`,
          {
            method: "POST",
            headers: {
              "X-API-KEY": process.env.SERPER_DEV_KEY,
              "Content-Type": "application/json",
            } as any,
            body: JSON.stringify({
              q: query,
              gl: location?.toLowerCase(),
            }),
          }
        );
        const dataSerpDev = await serperDevResponse.json();
        const followUpLink =
          dataSerpDev?.peopleAlsoAsk?.map((result: any) => ({
            link: result?.link,
            question: result?.question,
          })) || [];
        const followUpQuery =
          dataSerpDev?.relatedSearches?.map((result: any) => ({
            link: "",
            question: result?.query,
          })) || [];
        return {
          links: dataSerpDev.organic.map((result: any) => result.link),
          followUpQuestion: [...followUpLink, ...followUpQuery],
        };

      default:
        throw new Error("Invalid search engine");
    }
  } catch (error) {
    console.log(error, "Got while fetching Serper Dev");
    return { links: [] };
  }
};

export const getSearchMethodLink = (count: number) => {
  if (count % 2 === 0) {
    return ESearchEngines.SERPER_DEV;
  }

  return ESearchEngines.GOOGLE_API;
};

export const getScrapePromise = async (link: string, index: number) => {
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 3000)
  );

  const scrapePromise = (async () => {
    try {
      console.log(`Start`, index);
      const startTime = performance.now();

      const response = await fetchWithTimeout(link, {}, 1800);
      const html = await response.text();
      const $ = cheerio.load(html);

      const metaData: any = await extractMetaData($);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${link}. Status: ${response.status}`);
      }

      const htmlTextMain = extractMainContent($);
      const plainText = cleanSourceText(htmlTextMain);

      const urlData = {
        url: link,
        text: plainText?.slice(0, 10000),
        meta_data: metaData,
      };

      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      console.log(
        `Full request completed for ${link}. Time taken: ${timeTaken.toFixed(
          2
        )} ms`
      );
      return urlData;
    } catch (er: any) {
      console.log(`Error processing ${link}:`, er?.message);
      return { url: link };
    }
  })();

  try {
    return await Promise.race([scrapePromise, timeoutPromise]);
  } catch (error) {
    console.log(`Execution timed out for ${link}`);
    return null;
  }
};
