<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

await navigateTo(
  '/teacher/courses',
  {
    replace: true,
  },
)
</script>

<template>
  <main class="redirect-page">
    <p>
      課堂現在只需要管理固定時段，正在返回課堂管理...
    </p>
  </main>
</template>

<style scoped>
.redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f6f6f6;
  color: #999999;
  font-size: 10px;
  text-align: center;
}
</style>