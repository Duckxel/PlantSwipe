import React from "react"
import { Plus, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BlogCard } from "@/components/blog/BlogCard"
import { useAuth } from "@/context/AuthContext"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import type { BlogPost } from "@/types/blog"
import { fetchBlogPostsPaginated } from "@/lib/blogs"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { checkEditorAccess } from "@/constants/userRoles"

const POSTS_PER_PAGE = 10

export default function BlogPage() {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()
  const { profile } = useAuth()
  const [posts, setPosts] = React.useState<BlogPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)
  const [offset, setOffset] = React.useState(0)
  const isAdmin = checkEditorAccess(profile)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  const seoTitle = t("seo.blog.listTitle", { defaultValue: "Aphylia Blog" })
  const seoDescription = t("seo.blog.listDescription", {
    defaultValue: "Stories, product updates, and horticulture lessons from the Aphylia team.",
  })
  usePageMetadata({ title: seoTitle, description: seoDescription })

  // Initial load
  const loadPosts = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const includeDrafts = checkEditorAccess(profile)
      const result = await fetchBlogPostsPaginated({ includeDrafts, limit: POSTS_PER_PAGE, offset: 0 })
      setPosts(result.posts)
      setHasMore(result.hasMore)
      setOffset(result.posts.length)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("blogPage.state.error", { defaultValue: "Failed to load blog posts." })
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [profile, t])

  // Load more posts
  const loadMorePosts = React.useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const includeDrafts = checkEditorAccess(profile)
      const result = await fetchBlogPostsPaginated({ includeDrafts, limit: POSTS_PER_PAGE, offset })
      setPosts((prev) => [...prev, ...result.posts])
      setHasMore(result.hasMore)
      setOffset((prev) => prev + result.posts.length)
    } catch (err) {
      console.error("Failed to load more posts:", err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, offset, profile])

  React.useEffect(() => {
    loadPosts().catch(() => {})
  }, [loadPosts])

  // Intersection observer for infinite scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMorePosts()
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, loadingMore, loading, loadMorePosts])

  const handleCreate = React.useCallback(() => {
    navigate("/blog/create")
  }, [navigate])

  const handleEdit = React.useCallback(
    (post: BlogPost) => {
      navigate(`/blog/${post.id}/edit`)
    },
    [navigate],
  )

  const heroTitle = t("blogPage.hero.title", { defaultValue: "Aphylia Blog" })
  const heroSubtitle = t("blogPage.hero.subtitle", {
    defaultValue: "Product updates, greenroom experiments, and gardening stories from our worldwide testers.",
  })

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 pb-16 space-y-10">
      <section className="rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-50 dark:from-[#1f1f1f] dark:via-[#151515] dark:to-[#0c0c0c] p-8 md:p-12 space-y-5 shadow-sm">
        <Badge className="rounded-2xl px-4 py-1 w-fit bg-white/70 dark:bg-white/10 text-emerald-700 dark:text-emerald-300">
          {t("blogPage.hero.badge", { defaultValue: "Stories & releases" })}
        </Badge>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 md:max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-semibold">{heroTitle}</h1>
            <p className="text-base text-stone-600 dark:text-stone-300">{heroSubtitle}</p>
          </div>
          {isAdmin && (
            <Button type="button" className="rounded-2xl self-start md:self-center" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("blogPage.actions.addPost", { defaultValue: "Add post" })}
            </Button>
          )}
        </div>
        {isAdmin && (
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-3xl">
            {t("blogPage.hero.helper", {
              defaultValue: "Admins can compose new posts on the dedicated editor page. Drafts remain private until published.",
            })}
          </p>
        )}
      </section>

      {loading && (
        <div className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-8 text-center text-sm text-stone-500 dark:text-stone-400">
          {t("blogPage.state.loading", { defaultValue: "Fetching the latest posts…" })}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-900/10 p-6 space-y-3 text-sm">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => {
              loadPosts().catch(() => {})
            }}
          >
            {t("blogPage.state.retry", { defaultValue: "Try again" })}
          </Button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 dark:border-[#3e3e42] p-8 text-center text-sm text-stone-500 dark:text-stone-400">
          {t("blogPage.state.empty", { defaultValue: "No blog posts yet. Check back soon!" })}
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} isAdmin={isAdmin} onEdit={isAdmin ? handleEdit : undefined} />
            ))}
          </div>

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("blogPage.state.loadingMore", { defaultValue: "Loading more posts…" })}
              </div>
            )}
            {!hasMore && posts.length > POSTS_PER_PAGE && (
              <p className="text-sm text-stone-400 dark:text-stone-500">
                {t("blogPage.state.noMorePosts", { defaultValue: "You've reached the end!" })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
