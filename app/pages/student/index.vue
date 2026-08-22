<script setup>
const { user, authenticated, initialized, loading, error, initializeLineAuth } = useLineAuth()

onMounted(async () => {
  const success = await initializeLineAuth()
  if (success && user.value?.role === 'TEACHER') await navigateTo('/teacher')
})
</script>

<template>
  <main class="portal">
    <p class="eyebrow">Tap Dance</p>
    <h1>學生入口</h1>
    <p v-if="loading || !initialized">正在連結 LINE…</p>
    <template v-else-if="authenticated && user?.role === 'STUDENT'">
      <p>你好，{{ user.displayName }}。你的課程、請假與補課紀錄會顯示在這裡。</p>
      <NuxtLink to="/">查看我的上課紀錄</NuxtLink>
    </template>
    <p v-else-if="error">{{ error }}</p>
    <p v-else>此網址僅供學生使用。</p>
  </main>
</template>

<style scoped>
.portal { max-width: 560px; margin: 0 auto; padding: 72px 24px; }
.eyebrow { margin: 0; color: #8a5a25; font-weight: 700; letter-spacing: .08em; }
h1 { margin: 8px 0 18px; }
a { color: #7a4617; font-weight: 700; }
</style>
