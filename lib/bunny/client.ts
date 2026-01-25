import { createHash } from 'crypto'

interface BunnyConfig {
  apiKey: string
  libraryId: string
  tokenKey: string
  cdnHostname: string
}

function getConfig(): BunnyConfig {
  const apiKey = process.env.BUNNY_API_KEY
  const libraryId = process.env.BUNNY_LIBRARY_ID
  const tokenKey = process.env.BUNNY_TOKEN_KEY
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME

  if (!apiKey || !libraryId) {
    throw new Error('BUNNY_API_KEY and BUNNY_LIBRARY_ID are required')
  }

  return {
    apiKey,
    libraryId,
    tokenKey: tokenKey || apiKey, // Use API key as token key if not specified
    cdnHostname: cdnHostname || `${libraryId}.b-cdn.net`,
  }
}

interface VideoInfo {
  videoId: string
  title: string
  status: number // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
  thumbnailUrl: string
  length: number // duration in seconds
  width: number
  height: number
}

export async function getVideo(videoId: string): Promise<VideoInfo | null> {
  const config = getConfig()

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos/${videoId}`,
      {
        headers: {
          AccessKey: config.apiKey,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    return {
      videoId: data.guid,
      title: data.title,
      status: data.status,
      thumbnailUrl: `https://${config.cdnHostname}/${videoId}/thumbnail.jpg`,
      length: data.length,
      width: data.width,
      height: data.height,
    }
  } catch {
    return null
  }
}

export async function createVideo(title: string): Promise<{
  videoId: string
  uploadUrl: string
} | null> {
  const config = getConfig()

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    return {
      videoId: data.guid,
      uploadUrl: `https://video.bunnycdn.com/library/${config.libraryId}/videos/${data.guid}`,
    }
  } catch {
    return null
  }
}

export async function deleteVideo(videoId: string): Promise<boolean> {
  const config = getConfig()

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos/${videoId}`,
      {
        method: 'DELETE',
        headers: {
          AccessKey: config.apiKey,
        },
      }
    )

    return response.ok
  } catch {
    return false
  }
}

export async function listVideos(
  page: number = 1,
  perPage: number = 100
): Promise<VideoInfo[]> {
  const config = getConfig()

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos?page=${page}&itemsPerPage=${perPage}`,
      {
        headers: {
          AccessKey: config.apiKey,
        },
      }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()

    return (data.items || []).map((item: Record<string, unknown>) => ({
      videoId: item.guid,
      title: item.title,
      status: item.status,
      thumbnailUrl: `https://${config.cdnHostname}/${item.guid}/thumbnail.jpg`,
      length: item.length,
      width: item.width,
      height: item.height,
    }))
  } catch {
    return []
  }
}

// Generate signed URL for video playback
export function generateSignedUrl(
  videoId: string,
  expiresInSeconds: number = 300 // 5 minutes default
): {
  embedUrl: string
  directUrl: string
  expiresAt: Date
} {
  const config = getConfig()
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds

  // Generate token hash
  const hashInput = `${config.tokenKey}${videoId}${expiresAt}`
  const token = createHash('sha256').update(hashInput).digest('hex')

  // Build URLs
  const embedUrl = `https://iframe.mediadelivery.net/embed/${config.libraryId}/${videoId}?token=${token}&expires=${expiresAt}`
  const directUrl = `https://${config.cdnHostname}/${videoId}/play_720p.mp4?token=${token}&expires=${expiresAt}`

  return {
    embedUrl,
    directUrl,
    expiresAt: new Date(expiresAt * 1000),
  }
}

// Generate upload credentials for direct upload from browser
export async function getUploadCredentials(
  title: string,
  expiresInMinutes: number = 60
): Promise<{
  videoId: string
  uploadUrl: string
  authorizationSignature: string
  authorizationExpire: number
  libraryId: string
} | null> {
  const config = getConfig()

  // First create the video
  const video = await createVideo(title)
  if (!video) {
    return null
  }

  const authorizationExpire = Math.floor(Date.now() / 1000) + expiresInMinutes * 60

  // Generate signature for TUS upload
  const signatureInput = `${config.libraryId}${config.apiKey}${authorizationExpire}${video.videoId}`
  const authorizationSignature = createHash('sha256').update(signatureInput).digest('hex')

  return {
    videoId: video.videoId,
    uploadUrl: `https://video.bunnycdn.com/tusupload`,
    authorizationSignature,
    authorizationExpire,
    libraryId: config.libraryId,
  }
}

// Get video status
export async function getVideoStatus(videoId: string): Promise<{
  status: 'processing' | 'ready' | 'failed'
  progress?: number
  error?: string
} | null> {
  const video = await getVideo(videoId)

  if (!video) {
    return null
  }

  switch (video.status) {
    case 0:
    case 1:
      return { status: 'processing', progress: 10 }
    case 2:
      return { status: 'processing', progress: 30 }
    case 3:
      return { status: 'processing', progress: 60 }
    case 4:
      return { status: 'ready' }
    case 5:
      return { status: 'failed', error: 'Video processing failed' }
    default:
      return { status: 'processing' }
  }
}

// Get thumbnail URL
export function getThumbnailUrl(videoId: string): string {
  const config = getConfig()
  return `https://${config.cdnHostname}/${videoId}/thumbnail.jpg`
}

// Get preview GIF URL
export function getPreviewGifUrl(videoId: string): string {
  const config = getConfig()
  return `https://${config.cdnHostname}/${videoId}/preview.webp`
}
