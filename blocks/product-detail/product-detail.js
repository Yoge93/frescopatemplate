import { createLumaProductImagePicture, readBlockConfig } from "../../scripts/aem.js";
import { isAuthorEnvironment, normalizeCategoryValue } from "../../scripts/scripts.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { getEnvironmentValue, getHostname } from "../../scripts/utils.js";

const AUTHOR_PRODUCT_DETAIL_ENDPOINT = "/graphql/execute.json/dsn-eds-configuration/productDescriptionByPathAndSKU;";
const PUBLISH_GRAPHQL_PROXY_ENDPOINT = "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/fetch-product-information";
const PUBLISH_PRODUCT_DETAIL_ENDPOINT_KEY = "productDescriptionByPathAndSKU";
const AUTHOR_PRODUCTS_ENDPOINT = "/graphql/execute.json/dsn-eds-configuration/productsListByPath;";
const PUBLISH_PRODUCTS_ENDPOINT_KEY = "productsListByPath";
let productDetailAuthorBasePromise;
let productDetailPublishEnvironmentPromise;

async function getProductDetailAuthorBase() {
  if (!productDetailAuthorBasePromise) {
    productDetailAuthorBasePromise = getHostname()
      .then((hostname) => (hostname || window.location.origin || "").replace(/\/$/, ""))
      .catch(() => (window.location.origin || "").replace(/\/$/, ""));
  }
  return productDetailAuthorBasePromise;
}

async function getProductDetailPublishEnvironment() {
  if (!productDetailPublishEnvironmentPromise) {
    productDetailPublishEnvironmentPromise = getEnvironmentValue().catch(() => undefined);
  }
  return productDetailPublishEnvironmentPromise;
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} - Parameter value
 */
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Update the page title with the selected product name
 * @param {Object} product - Product data
 */
function updatePageTitle(product) {
  const productTitle = (product?.name || "").trim();
  if (productTitle) {
    document.title = productTitle;
  }
}

/**
 * Fetch product details from GraphQL
 * @param {string} path - Content fragment folder path
 * @param {string} sku - Product SKU
 * @param {boolean} isAuthor - Is author environment
 * @returns {Promise<Object|null>} - Product data
 */
async function fetchProductDetail(path, sku, isAuthor) {
  try {
    if (!path || !sku) {
      // eslint-disable-next-line no-console
      console.error("Product Detail: Missing path or SKU");
      return null;
    }
    const skuItem = isAuthor ? `;sku=${sku}` : `&sku=${sku}`;
    const authorBase = await getProductDetailAuthorBase();
    const environment = await getProductDetailPublishEnvironment();
    const url = isAuthor
      ? `${authorBase}${AUTHOR_PRODUCT_DETAIL_ENDPOINT}_path=${path}${skuItem}`
      : `${PUBLISH_GRAPHQL_PROXY_ENDPOINT}?endpoint=${PUBLISH_PRODUCT_DETAIL_ENDPOINT_KEY}${environment ? `&environment=${environment}` : ''}&_path=${path};sku=${sku}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const json = await resp.json();
    const items = json?.data?.productModelList?.items || [];
    return items.length > 0 ? items[0] : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch error", e);
    return null;
  }
}

/**
 * Fetch all products from a folder
 * @param {string} path - Content fragment folder path
 * @param {boolean} isAuthor - Is author environment
 * @returns {Promise<Array>} - Array of products
 */
async function fetchAllProducts(path, isAuthor) {
  try {
    if (!path) {
      return [];
    }
    const authorBase = await getProductDetailAuthorBase();
    const environment = await getProductDetailPublishEnvironment();
    const url = isAuthor
      ? `${authorBase}${AUTHOR_PRODUCTS_ENDPOINT}_path=${path}`
      : `${PUBLISH_GRAPHQL_PROXY_ENDPOINT}?endpoint=${PUBLISH_PRODUCTS_ENDPOINT_KEY}${environment ? `&environment=${environment}` : ''}&_path=${path}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const json = await resp.json();
    const items = json?.data?.productModelList?.items || [];
    const filtered = items.filter((item) => item && item.sku);
    return filtered;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch all products error", e);
    return [];
  }
}

/**
 * Build a recommendation card
 * @param {Object} item - Product data
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} - Product card
 */
function buildRecommendationCard(item, isAuthor) {
  const { id, sku, name, damImageURL = {}, category = [] } = item || {};
  const productId = sku || id || "";

  const card = document.createElement("article");
  card.className = "pd-rec-card";

  // Make card clickable and redirect to product page
  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;

      // Smart path construction: ensure we navigate to the correct product page
      let basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));

      // If the current page doesn't have a language segment, try to add it
      const langPattern = /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)$/;
      if (!langPattern.test(basePath) && !basePath.includes("/en/")) {
        const pathMatch = currentPath.match(
          /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)\//
        );
        if (pathMatch) {
          const langCode = pathMatch[1];
          const langIndex = currentPath.indexOf(`/${langCode}/`);
          basePath = currentPath.substring(0, langIndex + langCode.length + 1);
        } else {
          basePath = `${basePath}/en`;
        }
      }

      // On author add .html extension, on publish don't
      const productPath = isAuthor
        ? `${basePath}/product.html`
        : `${basePath}/product`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(
        productId
      )}`;
    });
  }

  let picture = null;
  if (damImageURL && (damImageURL._dynamicUrl || damImageURL._publishUrl || damImageURL._authorUrl)) {
    picture = createLumaProductImagePicture(damImageURL, name || "Product image", {
      isAuthor,
      eager: false,
    });
  }

  const imgWrap = document.createElement("div");
  imgWrap.className = "pd-rec-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "pd-rec-card-meta";
  const cat = document.createElement("p");
  cat.className = "pd-rec-card-category";
  cat.textContent = category
    .map((catValue) => normalizeCategoryValue(catValue).replace(/\//g, " / "))
    .filter(Boolean)
    .join(" / ");
  const title = document.createElement("h3");
  title.className = "pd-rec-card-title";
  title.textContent = name || "";
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

/**
 * Build product detail view
 * @param {Object} product - Product data
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} - Product detail container
 */
function buildProductDetail(product, isAuthor, eventConfig = {}) {
  const {
    name,
    price,
    category = [],
    description = {},
    damImageURL = {},
    sku,
    id,
  } = product;
  const isPlansCategory = (category || [])
    .map((catValue) => normalizeCategoryValue(catValue).toLowerCase().trim())
    .some((catValue) => catValue === "plans" || catValue.endsWith("/plans"));

  // Update dataLayer with product information
  // If dataLayer is not ready, the update will be queued automatically
  const imageUrl = isAuthor ? damImageURL?._authorUrl : damImageURL?._publishUrl;

  const productData = {
    id: id || sku || "",
    sku: sku || "",
    name: name || "",
    price: price || 0,
    category:
      category.length > 0
        ? category
            .map((catValue) => normalizeCategoryValue(catValue).replace(/\//g, " / "))
            .join(", ")
        : "",
    description: description?.html || description?.markdown || "",
    image: imageUrl || "",
    thumbnail: imageUrl || "",
  };

  if (typeof window.updateDataLayer === "function") {
    window.updateDataLayer({ product: productData });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ window.updateDataLayer not available, product data not sent"
    );
  }

  const container = document.createElement("div");
  container.className = "pd-container";

  // Image section
  const imageSection = document.createElement("div");
  imageSection.className = "pd-image";

  if (damImageURL && (damImageURL._dynamicUrl || damImageURL._publishUrl || damImageURL._authorUrl)) {
    const picture = createLumaProductImagePicture(damImageURL, name || "Product image", {
      isAuthor,
      eager: true,
    });
    if (picture) imageSection.appendChild(picture);
  }

  // Content section
  const contentSection = document.createElement("div");
  contentSection.className = "pd-content";

  // Category
  if (category && category.length > 0) {
    const categoryText = category
      .map(
        (catValue) =>
          normalizeCategoryValue(catValue)
            .replace(/\//g, " / ") // Replace slashes with /
      )
      .join(" / ");
    const categoryEl = document.createElement("p");
    categoryEl.className = "pd-category";
    categoryEl.textContent = categoryText;
    contentSection.appendChild(categoryEl);
  }

  // Name
  const nameEl = document.createElement("h1");
  nameEl.className = "pd-name";
  nameEl.textContent = name || "";
  contentSection.appendChild(nameEl);

  // Price
  if (price) {
    const priceEl = document.createElement("p");
    priceEl.className = "pd-price";
    priceEl.textContent = `$${price}`;
    contentSection.appendChild(priceEl);
  }

  // Description (using HTML format)
  if (description?.html) {
    const descEl = document.createElement("div");
    descEl.className = "pd-description";
    descEl.innerHTML = description.html;
    contentSection.appendChild(descEl);
  }

  // Action buttons

  const actionsEl = document.createElement("div");
  actionsEl.className = "pd-actions";

  // Add to Cart button (conditionally rendered)
  if (eventConfig.showAddToCartButton !== false) {
    const addToCartBtn = document.createElement("button");
    addToCartBtn.className = "pd-btn pd-btn-primary";
    addToCartBtn.textContent = "Add to Cart";
    addToCartBtn.setAttribute("aria-label", `Add ${name} to cart`);
    addToCartBtn.addEventListener("click", () => {
      const cartImageUrl = isAuthor ? damImageURL?._authorUrl : damImageURL?._publishUrl;
      const formattedCategory =
        category.length > 0
          ? category
              .map((catValue) => normalizeCategoryValue(catValue).replace(/\//g, " / "))
              .join(", ")
          : "";

      window.addToCart({
        id: id || sku || "",
        name: name || "",
        image: cartImageUrl || "",
        thumbnail: cartImageUrl || "",
        category: formattedCategory,
        description: description?.html || description?.markdown || "",
        price: price || 0,
        quantity: 1,
      });
      if (eventConfig.addToCart) {
        dispatchCustomEvent(eventConfig.addToCart);
      }

      // Show visual feedback
      addToCartBtn.textContent = "Added to Cart ✓";
      setTimeout(() => {
        addToCartBtn.textContent = "Add to Cart";
      }, 2000);
    });
    actionsEl.append(addToCartBtn);
  }

  if (isPlansCategory) {
    const selectDeviceBtn = document.createElement("button");
    selectDeviceBtn.className = "pd-btn pd-btn-secondary";
    selectDeviceBtn.textContent = "Select a device";
    selectDeviceBtn.setAttribute("aria-label", "Select a device");
    selectDeviceBtn.addEventListener("click", () => {
      window.location.href = "/en/phones";
    });
    actionsEl.append(selectDeviceBtn);
  }

  if (eventConfig.showAddToWishlistButton) {
    const addToWishlistBtn = document.createElement("button");
    addToWishlistBtn.className = "pd-btn pd-btn-secondary";
    addToWishlistBtn.textContent = "Add to Wishlist";
    addToWishlistBtn.setAttribute("aria-label", `Add ${name} to wishlist`);
    addToWishlistBtn.addEventListener("click", () => {
      if (eventConfig.addToWishlist) {
        dispatchCustomEvent(eventConfig.addToWishlist);
      }
    });
    actionsEl.append(addToWishlistBtn);
  }

  contentSection.appendChild(actionsEl);

  container.append(imageSection, contentSection);
  return container;
}

/**
 * Build "You May Also Like" recommendations section
 * @param {Object} currentProduct - Current product data
 * @param {Array} allProducts - All products from the folder
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement|null} - Recommendations section or null
 */
function buildRecommendations(currentProduct, allProducts, isAuthor) {
  const { sku: currentSku, category: currentCategories = [] } = currentProduct;

  if (!currentCategories || currentCategories.length === 0) {
    return null;
  }

  // Filter products by matching category
  const recommendations = allProducts
    .filter((product) => {
      // Exclude current product
      if (product.sku === currentSku) return false;

      // Check if product has any matching category
      const productCategories = product.category || [];
      return productCategories.some((cat) => currentCategories.includes(cat));
    })
    .slice(0, 5); // Limit to 5 products

  if (recommendations.length === 0) {
    return null;
  }

  // Build recommendations section
  const section = document.createElement("div");
  section.className = "pd-recommendations";

  const title = document.createElement("h2");
  title.className = "pd-rec-title";
  title.textContent = "YOU MAY ALSO LIKE";

  const grid = document.createElement("div");
  grid.className = "pd-rec-grid";

  recommendations.forEach((product) => {
    const card = buildRecommendationCard(product, isAuthor);
    grid.append(card);
  });

  section.append(title, grid);

  return section;
}

/**
 * Decorate the product detail block
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const isTruthy = (value) => value === true || String(value || '').trim().toLowerCase() === 'true';
  const isAuthor = isAuthorEnvironment();

  // Read block config for authorable event types and folder path
  const config = readBlockConfig(block);
  const eventConfig = {
    productView: (config.productvieweventtype || config['product-view-event-type'] || '').trim(),
    addToCart: (config.addtocarteventtype || config['add-to-cart-event-type'] || '').trim(),
    addToWishlist: (config.addtowishlisteventtype || config['add-to-wishlist-event-type'] || '').trim(),
    showAddToCartButton: (config.showaddtocartbutton === undefined && config['show-add-to-cart-button'] === undefined)
      ? true
      : isTruthy(config.showaddtocartbutton ?? config['show-add-to-cart-button']),
    showAddToWishlistButton: (config.showaddtowishlistbutton === undefined && config['show-add-to-wishlist-button'] === undefined)
      ? true
      : isTruthy(config.showaddtowishlistbutton ?? config['show-add-to-wishlist-button']),
    showYouMayAlsoLikeSection: (config.showyoumayalsolikesection === undefined && config['show-you-may-also-like-section'] === undefined)
      ? true
      : isTruthy(config.showyoumayalsolikesection ?? config['show-you-may-also-like-section']),
  };

  // Extract folder path from block config
  let folderHref = "";
  const link = block.querySelector("a[href]");
  if (link) {
    folderHref = link.getAttribute("href");
  } else {
    folderHref = config.folder || "";
  }

  // Strip .html extension if present
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Get SKU from URL query parameter
  const sku = getQueryParam("productId");

  // Clear block content
  block.textContent = "";

  if (!folderHref) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent =
      "Please configure the product folder path in the properties panel.";
    block.appendChild(errorMsg);
    return;
  }

  if (!sku) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found. Missing product ID in URL.";
    block.appendChild(errorMsg);
    return;
  }

  // Show loading state
  const loader = document.createElement("p");
  loader.className = "pd-loading";
  loader.textContent = "Loading product details...";
  block.appendChild(loader);

  // Fetch product and (optionally) recommendations source data in parallel
  const [product, allProducts] = await Promise.all([
    fetchProductDetail(folderHref, sku, isAuthor),
    eventConfig.showYouMayAlsoLikeSection
      ? fetchAllProducts(folderHref, isAuthor)
      : Promise.resolve([]),
  ]);

  block.textContent = "";

  if (!product) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found or failed to load.";
    block.appendChild(errorMsg);
    return;
  }

  updatePageTitle(product);

  // Display product detail
  const productDetail = buildProductDetail(product, isAuthor, eventConfig);
  block.appendChild(productDetail);

  // Display recommendations
  if (eventConfig.showYouMayAlsoLikeSection) {
    const recommendations = buildRecommendations(product, allProducts, isAuthor);
    if (recommendations) {
      block.appendChild(recommendations);
    }
  }
  if (eventConfig.productView) {
    dispatchCustomEvent(eventConfig.productView);
  }
}
