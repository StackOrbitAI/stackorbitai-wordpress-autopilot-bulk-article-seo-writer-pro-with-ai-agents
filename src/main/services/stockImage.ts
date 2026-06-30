import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { dbGet } from '../database/connection';
import { generateArticle, generateMultimodalAnalysis } from './ai';

export const usedImageUrls = new Set<string>();

async function downloadImageAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    return {
      mimeType: contentType,
      base64: buffer.toString('base64')
    };
  } catch (err: any) {
    console.warn(`[Vision Image Downloader] Failed to download preview image from ${url}: ${err.message}`);
    return null;
  }
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'for', 'to', 'with', 'is', 'of',
  'how', 'best', 'why', 'what', 'where', 'who', 'top', 'ways', 'methods', 'tips', 'guide',
  'tutorial', 'list', 'about', 'from', 'by', 'that', 'this', 'these', 'those', 'are', 'was', 'were',
  'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'but', 'not', 'some', 'any', 'each',
  'few', 'more', 'most', 'other', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
  'will', 'just', 'should', 'would', 'now'
]);

function getKeywordWords(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function calculateRelevance(text: string, keywordWords: string[]): number {
  if (!text) return 0;
  let score = 0;
  const lowercaseText = text.toLowerCase();
  keywordWords.forEach(word => {
    if (lowercaseText.includes(word)) {
      score += 1;
      // Extra weight for exact word match
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lowercaseText)) {
        score += 2;
      }
    }
  });
  return score;
}

/**
 * Scores candidates using the configured LLM for high-accuracy semantic matching
 */
async function scoreCandidatesWithAI(
  keyword: string,
  candidates: { alt: string; description: string; tags: string; url?: string }[],
  aiConfig: { provider: string; apiKey: string; baseUrl?: string; organization?: string }
): Promise<number | null> {
  try {
    let model = 'gpt-4o-mini';
    if (aiConfig.provider === 'gemini') {
      model = 'gemini-1.5-flash';
    } else if (aiConfig.provider === 'claude') {
      model = 'claude-3-5-haiku-latest';
    } else if (aiConfig.provider === 'openrouter') {
      model = 'google/gemini-1.5-flash';
    }

    // Take the top 3 candidates for vision analysis
    const visionCandidates = candidates.slice(0, 3);
    const downloadPromises = visionCandidates.map(async (c) => {
      if (c.url) {
        const b64Data = await downloadImageAsBase64(c.url);
        return { ...c, b64Data };
      }
      return { ...c, b64Data: null };
    });
    const enrichedCandidates = await Promise.all(downloadPromises);
    const validImages = enrichedCandidates.filter(c => c.b64Data !== null) as { alt: string; description: string; tags: string; url?: string; b64Data: { mimeType: string; base64: string } }[];

    if (validImages.length > 0) {
      console.log(`[StockImage AI Vision Selector] Analyzing ${validImages.length} candidates with Vision for topic: "${keyword}"`);
      
      const prompt = `You are an editorial director selecting a featured image for a blog post titled "${keyword}".
We have downloaded ${validImages.length} candidate stock images. Analyze their visual content, objects, theme, and composition to determine which candidate matches the topic "${keyword}" best.

Candidate Details:
${validImages.map((c, i) => `[Image ${i}]: Alt: ${c.alt || 'N/A'}. Tags: ${c.tags || 'N/A'}. Description: ${c.description || 'N/A'}`).join('\n')}

Identify the single best candidate. You must return ONLY the integer index (e.g. 0, 1, or 2) of the chosen image. Do NOT write any other text, explanation, or markdown. Only output a single integer.`;

      const result = await generateMultimodalAnalysis(
        aiConfig as any,
        model,
        prompt,
        validImages.map(img => img.b64Data),
        "You are a precise selector that returns only a single integer index representing the chosen option."
      );

      const cleanResult = result.text.trim().replace(/[^\d]/g, '');
      const index = parseInt(cleanResult, 10);
      if (!isNaN(index) && index >= 0 && index < validImages.length) {
        // Map back to the original index in the 'candidates' array
        const chosenUrl = validImages[index].url;
        const originalIndex = candidates.findIndex(c => c.url === chosenUrl);
        if (originalIndex !== -1) {
          console.log(`[StockImage AI Vision Selector] Vision chose image index ${originalIndex} (matching Vision candidate ${index}) for "${keyword}"`);
          return originalIndex;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[StockImage AI Vision Selector] Vision matching failed: ${err.message}. Falling back to metadata ranking.`);
  }

  // Fallback to text metadata-only scoring if vision fails or there are no valid images
  try {
    let model = 'gpt-4o-mini';
    if (aiConfig.provider === 'gemini') {
      model = 'gemini-1.5-flash';
    } else if (aiConfig.provider === 'claude') {
      model = 'claude-3-5-haiku-latest';
    } else if (aiConfig.provider === 'openrouter') {
      model = 'google/gemini-1.5-flash';
    }

    const prompt = `You are an editorial director selecting a featured image for a blog post titled "${keyword}".
Below is a list of candidate stock photo descriptions, alt text, and tags. Evaluate which photo has the highest semantic relevance, visual suitability, and thematic match for the article title.

Candidates:
${candidates.map((c, i) => `[Image ${i}]: Alt: ${c.alt || 'N/A'}. Tags: ${c.tags || 'N/A'}. Description: ${c.description || 'N/A'}`).join('\n')}

Identify the single best candidate. You must return ONLY the integer index (e.g. 0, 1, 2) of the chosen image. Do NOT write any other text, explanation, or markdown. Only output a single integer.`;

    const result = await generateArticle(
      aiConfig as any,
      model,
      prompt,
      "You are a precise selector that returns only a single integer index representing the chosen option."
    );

    const cleanResult = result.text.trim().replace(/[^\d]/g, '');
    const index = parseInt(cleanResult, 10);
    if (!isNaN(index) && index >= 0 && index < candidates.length) {
      console.log(`[StockImage AI Metadata Selector] AI chose image index ${index} for "${keyword}"`);
      return index;
    }
  } catch (err: any) {
    console.warn(`[StockImage AI Metadata Selector] AI matching failed: ${err.message}. Falling back to local ranking.`);
  }
  return null;
}

/**
 * Fetches search results from a specific stock photo provider, ranks them,
 * and returns the best image URL.
 */
async function fetchFromProvider(
  keyword: string,
  provider: number,
  aiConfig?: { provider: string; apiKey: string }
): Promise<string> {
  const keywordWords = getKeywordWords(keyword);
  const searchQueries = keywordWords.length > 0 ? [keywordWords.join(' '), keyword] : [keyword];

  if (provider === 3) {
    // Unsplash API (Primary / Main)
    const apiKeySetting = await dbGet(`SELECT value FROM settings WHERE key = 'unsplash_api_key'`);
    const apiKey = apiKeySetting?.value || '';
    if (!apiKey) {
      throw new Error('Unsplash Access Key is not configured');
    }

    for (const query of searchQueries) {
      try {
        const response = await axios.get(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
          {
            headers: { Authorization: `Client-ID ${apiKey}` },
            timeout: 20000
          }
        );

        const results = response.data?.results || [];
        const unusedResults = results.filter((photo: any) => {
          const url = photo.urls?.regular || photo.urls?.full;
          return url && !usedImageUrls.has(url);
        });
        const finalResults = unusedResults.length > 0 ? unusedResults : results;

        if (finalResults.length > 0) {
          // If AI config is provided, try semantic matching first
          if (aiConfig) {
            const candidates = finalResults.map((photo: any) => ({
              alt: photo.alt_description || '',
              description: photo.description || '',
              tags: (photo.tags || []).map((t: any) => t.title || '').join(', '),
              url: photo.urls?.small || photo.urls?.thumb
            }));
            const bestIndex = await scoreCandidatesWithAI(keyword, candidates, aiConfig);
            if (bestIndex !== null) {
              const finalUrl = finalResults[bestIndex].urls?.regular || finalResults[bestIndex].urls?.full;
              if (finalUrl) return finalUrl;
            }
          }

          // Local fallback ranking
          let bestPhoto = finalResults[0];
          let maxScore = -1;
          for (const photo of finalResults) {
            const photoText = [
              photo.description || '',
              photo.alt_description || '',
              ...(photo.tags || []).map((t: any) => t.title || '')
            ].join(' ');
            const score = calculateRelevance(photoText, keywordWords);
            if (score > maxScore) {
              maxScore = score;
              bestPhoto = photo;
            }
          }
          const finalUrl = bestPhoto.urls?.regular || bestPhoto.urls?.full;
          if (finalUrl) return finalUrl;
        }
      } catch (err: any) {
        console.warn(`[Unsplash Search] Query "${query}" failed:`, err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
          throw new Error(`Unsplash API authorization or rate limit error: ${err.message}`);
        }
      }
    }
    throw new Error(`No images found on Unsplash for keyword: "${keyword}"`);
  } 
  
  if (provider === 2) {
    // Pexels API
    const apiKeySetting = await dbGet(`SELECT value FROM settings WHERE key = 'pexels_api_key'`);
    const apiKey = apiKeySetting?.value || '';
    if (!apiKey) {
      throw new Error('Pexels API Key is not configured');
    }

    for (const query of searchQueries) {
      try {
        const response = await axios.get(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`,
          {
            headers: { Authorization: apiKey },
            timeout: 20000
          }
        );

        const photos = response.data?.photos || [];
        const unusedPhotos = photos.filter((photo: any) => {
          const url = photo.src?.large2x || photo.src?.large || photo.src?.original;
          return url && !usedImageUrls.has(url);
        });
        const finalPhotos = unusedPhotos.length > 0 ? unusedPhotos : photos;

        if (finalPhotos.length > 0) {
          // If AI config is provided, try semantic matching first
          if (aiConfig) {
            const candidates = finalPhotos.map((photo: any) => ({
              alt: photo.alt || '',
              description: photo.url || '',
              tags: '',
              url: photo.src?.medium || photo.src?.tiny
            }));
            const bestIndex = await scoreCandidatesWithAI(keyword, candidates, aiConfig);
            if (bestIndex !== null) {
              const finalUrl = finalPhotos[bestIndex].src?.large2x || finalPhotos[bestIndex].src?.large || finalPhotos[bestIndex].src?.original;
              if (finalUrl) return finalUrl;
            }
          }

          let bestPhoto = finalPhotos[0];
          let maxScore = -1;
          for (const photo of finalPhotos) {
            const photoText = [
              photo.alt || '',
              photo.url || ''
            ].join(' ');
            const score = calculateRelevance(photoText, keywordWords);
            if (score > maxScore) {
              maxScore = score;
              bestPhoto = photo;
            }
          }
          const finalUrl = bestPhoto.src?.large2x || bestPhoto.src?.large || bestPhoto.src?.original;
          if (finalUrl) return finalUrl;
        }
      } catch (err: any) {
        console.warn(`[Pexels Search] Query "${query}" failed:`, err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
          throw new Error(`Pexels API authorization or rate limit error: ${err.message}`);
        }
      }
    }
    throw new Error(`No images found on Pexels for keyword: "${keyword}"`);
  } 
  
  if (provider === 4) {
    // Pixabay API
    const apiKeySetting = await dbGet(`SELECT value FROM settings WHERE key = 'pixabay_api_key'`);
    const apiKey = apiKeySetting?.value || '';
    if (!apiKey) {
      throw new Error('Pixabay API Key is not configured');
    }

    for (const query of searchQueries) {
      try {
        const response = await axios.get(
          `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=10&image_type=photo`,
          { timeout: 20000 }
        );

        const hits = response.data?.hits || [];
        const unusedHits = hits.filter((hit: any) => {
          const url = hit.largeImageURL || hit.webformatURL;
          return url && !usedImageUrls.has(url);
        });
        const finalHits = unusedHits.length > 0 ? unusedHits : hits;

        if (finalHits.length > 0) {
          // If AI config is provided, try semantic matching first
          if (aiConfig) {
            const candidates = finalHits.map((hit: any) => ({
              alt: hit.tags || '',
              description: hit.tags || '',
              tags: hit.tags || '',
              url: hit.previewURL || hit.webformatURL
            }));
            const bestIndex = await scoreCandidatesWithAI(keyword, candidates, aiConfig);
            if (bestIndex !== null) {
              const finalUrl = finalHits[bestIndex].largeImageURL || finalHits[bestIndex].webformatURL;
              if (finalUrl) return finalUrl;
            }
          }

          let bestPhoto = finalHits[0];
          let maxScore = -1;
          for (const hit of finalHits) {
            const photoText = hit.tags || '';
            const score = calculateRelevance(photoText, keywordWords);
            if (score > maxScore) {
              maxScore = score;
              bestPhoto = hit;
            }
          }
          const finalUrl = bestPhoto.largeImageURL || bestPhoto.webformatURL;
          if (finalUrl) return finalUrl;
        }
      } catch (err: any) {
        console.warn(`[Pixabay Search] Query "${query}" failed:`, err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
          throw new Error(`Pixabay API authorization or rate limit error: ${err.message}`);
        }
      }
    }
    throw new Error(`No images found on Pixabay for keyword: "${keyword}"`);
  }

  throw new Error(`Unknown stock image provider ID: ${provider}`);
}

async function fetchFromNasa(keyword: string): Promise<string> {
  const keywordWords = getKeywordWords(keyword);
  const query = keywordWords.length > 0 ? keywordWords.join(' ') : keyword;
  const res = await axios.get(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`, { timeout: 15005 });
  const items = res.data?.collection?.items || [];
  if (items.length > 0) {
    const hrefRes = await axios.get(items[0].href, { timeout: 15005 });
    const images = hrefRes.data || [];
    const origImage = images.find((img: string) => img.endsWith('~orig.jpg') || img.endsWith('~large.jpg') || img.endsWith('.jpg'));
    if (origImage) return origImage;
    if (images.length > 0) return images[0];
  }
  throw new Error(`No images found on NASA for keyword: "${keyword}"`);
}

async function fetchFromWikimedia(keyword: string): Promise<string> {
  const keywordWords = getKeywordWords(keyword);
  const query = keywordWords.length > 0 ? keywordWords.join(' ') : keyword;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url&gsrlimit=5&format=json&origin=*`;
  const res = await axios.get(url, { timeout: 15005 });
  const pages = res.data?.query?.pages || {};
  for (const pageId of Object.keys(pages)) {
    const imgUrl = pages[pageId]?.imageinfo?.[0]?.url;
    if (imgUrl && imgUrl.toLowerCase().match(/\.(jpg|jpeg|png)$/) && !usedImageUrls.has(imgUrl)) {
      return imgUrl;
    }
  }
  throw new Error(`No images found on Wikimedia Commons for keyword: "${keyword}"`);
}

async function fetchFromOpenverse(keyword: string): Promise<string> {
  const keywordWords = getKeywordWords(keyword);
  const query = keywordWords.length > 0 ? keywordWords.join(' ') : keyword;
  const url = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(query)}&page_size=5`;
  const res = await axios.get(url, { timeout: 15005 });
  const results = res.data?.results || [];
  if (results.length > 0) {
    const unusedResults = results.filter((r: any) => r.url && !usedImageUrls.has(r.url));
    const finalResults = unusedResults.length > 0 ? unusedResults : results;
    return finalResults[0].url;
  }
  throw new Error(`No images found on Openverse for keyword: "${keyword}"`);
}

/**
 * Searches and downloads an image based on keyword.
 * Implements a smart fallback chain starting with the chosen provider or niche preset.
 * Returns the local file path.
 */
export async function getStockImage(
  keyword: string, 
  provider: number, 
  aiConfig?: { provider: string; apiKey: string }
): Promise<string> {
  interface ChainItem {
    type: 'stock' | 'nasa' | 'wikimedia' | 'openverse';
    id?: number;
  }
  
  let chain: ChainItem[] = [];
  
  if (provider === 2) {
    chain = [{ type: 'stock', id: 2 }, { type: 'stock', id: 3 }, { type: 'stock', id: 4 }];
  } else if (provider === 3) {
    chain = [{ type: 'stock', id: 3 }, { type: 'stock', id: 2 }, { type: 'stock', id: 4 }];
  } else if (provider === 4) {
    chain = [{ type: 'stock', id: 4 }, { type: 'stock', id: 3 }, { type: 'stock', id: 2 }];
  }
  // Niche-wise selections
  else if (provider === 10) { // Tech/AI: Unsplash + Pixabay
    chain = [{ type: 'stock', id: 3 }, { type: 'stock', id: 4 }, { type: 'stock', id: 2 }];
  } else if (provider === 11) { // Food: Pexels + Unsplash
    chain = [{ type: 'stock', id: 2 }, { type: 'stock', id: 3 }, { type: 'stock', id: 4 }];
  } else if (provider === 12) { // Travel: Flickr (falls back) + Pexels + Unsplash
    chain = [{ type: 'stock', id: 2 }, { type: 'stock', id: 3 }, { type: 'stock', id: 4 }];
  } else if (provider === 13) { // Health/Fitness: Pexels + Pixabay
    chain = [{ type: 'stock', id: 2 }, { type: 'stock', id: 4 }, { type: 'stock', id: 3 }];
  } else if (provider === 14) { // Education: Wikimedia + Openverse + Pixabay
    chain = [{ type: 'wikimedia' }, { type: 'openverse' }, { type: 'stock', id: 4 }, { type: 'stock', id: 3 }];
  } else if (provider === 15) { // Science/Space: NASA + Pixabay
    chain = [{ type: 'nasa' }, { type: 'stock', id: 4 }, { type: 'stock', id: 3 }];
  } else if (provider === 16) { // E-commerce: Burst/Pexels
    chain = [{ type: 'stock', id: 2 }, { type: 'stock', id: 3 }, { type: 'stock', id: 4 }];
  } else if (provider === 17) { // Finance/Business: Unsplash + StockSnap
    chain = [{ type: 'stock', id: 3 }, { type: 'stock', id: 2 }, { type: 'stock', id: 4 }];
  } else if (provider === 18) { // Creative/Art: Reshot/Gratisography
    chain = [{ type: 'stock', id: 4 }, { type: 'stock', id: 3 }, { type: 'stock', id: 2 }];
  } else if (provider === 19) { // Nature/Environment: Pixabay
    chain = [{ type: 'stock', id: 4 }, { type: 'stock', id: 3 }, { type: 'stock', id: 2 }];
  } else {
    chain = [{ type: 'stock', id: 3 }, { type: 'stock', id: 2 }, { type: 'stock', id: 4 }];
  }

  // Add all public key-less providers to the very end of any chain as safety nets
  chain.push({ type: 'nasa' });
  chain.push({ type: 'wikimedia' });
  chain.push({ type: 'openverse' });

  const errors: string[] = [];
  let acquiredUrl = '';
  
  for (const item of chain) {
    try {
      if (item.type === 'stock' && item.id) {
        console.log(`[StockImage] Trying stock provider ${item.id} for keyword: "${keyword}"`);
        acquiredUrl = await fetchFromProvider(keyword, item.id, aiConfig);
      } else if (item.type === 'nasa') {
        console.log(`[StockImage] Trying NASA Images API for keyword: "${keyword}"`);
        acquiredUrl = await fetchFromNasa(keyword);
      } else if (item.type === 'wikimedia') {
        console.log(`[StockImage] Trying Wikimedia Commons API for keyword: "${keyword}"`);
        acquiredUrl = await fetchFromWikimedia(keyword);
      } else if (item.type === 'openverse') {
        console.log(`[StockImage] Trying Openverse API for keyword: "${keyword}"`);
        acquiredUrl = await fetchFromOpenverse(keyword);
      }
      
      if (acquiredUrl) {
        console.log(`[StockImage] Successfully acquired image from ${item.type}: ${acquiredUrl}`);
        usedImageUrls.add(acquiredUrl);
        break;
      }
    } catch (err: any) {
      console.warn(`[StockImage] ${item.type} failed: ${err.message}`);
      errors.push(`${item.type}: ${err.message}`);
    }
  }

  if (!acquiredUrl) {
    throw new Error(`All stock image providers failed to retrieve an image. Details: [${errors.join('; ')}]`);
  }
  
  return await downloadImage(acquiredUrl);
}

async function downloadImage(imageUrl: string): Promise<string> {
  let userDataPath: string;
  try {
    userDataPath = app.getPath('userData');
  } catch (error) {
    userDataPath = path.resolve(__dirname, '../../');
  }

  const downloadsDir = path.join(userDataPath, 'temp_images');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const filename = `stock_img_${Date.now()}_${randomSuffix}.png`;
  const localPath = path.join(downloadsDir, filename);

  const response = await axios({
    method: 'get',
    url: imageUrl,
    responseType: 'stream',
    timeout: 30000
  });

  const writer = fs.createWriteStream(localPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(localPath));
    writer.on('error', (err) => reject(err));
  });
}
