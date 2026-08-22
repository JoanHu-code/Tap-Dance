<script setup>
const {
  $liff,
} = useNuxtApp()

const loading = ref(true)

const loginLoading = ref(false)

const errorMessage = ref('')

const teacher = ref(null)

const students = ref([])

const courses = ref([])

const dashboardLoaded = ref(false)

const activeStudents = computed(() => {
  return students.value.filter(
    (student) => {
      return (
        !student.status ||
        student.status === 'ACTIVE'
      )
    }
  )
})

const linkedStudents = computed(() => {
  return students.value.filter(
    (student) => {
      return Boolean(
        student.user_id
      )
    }
  )
})

const unlinkedStudents = computed(() => {
  return students.value.filter(
    (student) => {
      return !student.user_id
    }
  )
})

const studentCount = computed(() => {
  return students.value.length
})

const courseCount = computed(() => {
  return courses.value.length
})

const getStudentName = (
  student
) => {
  return (
    student.name ||
    student.display_name ||
    student.full_name ||
    `學生 #${student.id}`
  )
}

const getStudentPhone = (
  student
) => {
  return (
    student.phone ||
    student.phone_number ||
    ''
  )
}

const getCourseName = (
  course
) => {
  return (
    course.name ||
    course.course_name ||
    `課程 #${course.id}`
  )
}

const getCourseDescription = (
  course
) => {
  return (
    course.description ||
    course.remark ||
    '尚未設定課程說明'
  )
}

const loginTeacher = async () => {
  if (loginLoading.value) {
    return
  }

  loginLoading.value = true
  errorMessage.value = ''

  try {
    await $liff.initialize(
      'TEACHER'
    )

    if (
      !$liff.isLoggedIn()
    ) {
      await $liff.login(
        'TEACHER'
      )

      return
    }

    const idToken =
      await $liff.getIdToken(
        'TEACHER'
      )

    if (!idToken) {
      throw new Error(
        '無法取得 LINE ID Token'
      )
    }

    const response =
      await $fetch(
        '/api/auth/teacher/line',
        {
          method: 'POST',

          body: {
            idToken,
          },
        }
      )

    teacher.value =
      response.user || null

    const authStore =
     useAuthStore()

    authStore.setTeacherLogin(
        response
    )

    students.value =
      response.dashboard
        ?.students || []

    courses.value =
      response.dashboard
        ?.courses || []

    dashboardLoaded.value = true
  } catch (error) {
    console.error(
      'Teacher login error:',
      error
    )

    errorMessage.value =
      error?.data
        ?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '老師端登入失敗'
  } finally {
    loginLoading.value = false
    loading.value = false
  }
}

const retryLogin = async () => {
  loading.value = true

  await loginTeacher()
}

onMounted(async () => {
  await loginTeacher()
})
</script>

<template>
  <main class="teacher-dashboard">
    <div
      v-if="loading"
      class="state-page"
    >
      <div class="state-card">
        <div class="loader" />

        <h2>
          正在登入老師端
        </h2>

        <p>
          正在確認 LINE 身分與載入課程資料。
        </p>
      </div>
    </div>

    <div
      v-else-if="errorMessage"
      class="state-page"
    >
      <div class="state-card">
        <div
          class="
            state-icon
            state-icon--error
          "
        >
          !
        </div>

        <h2>
          無法進入老師端
        </h2>

        <p>
          {{ errorMessage }}
        </p>

        <button
          type="button"
          class="primary-button"
          @click="retryLogin"
        >
          重新嘗試
        </button>
      </div>
    </div>

    <div
      v-else-if="dashboardLoaded"
      class="dashboard-container"
    >
      <header class="dashboard-header">
        <div>
          <span class="eyebrow">
            Tap Dance
          </span>

          <h1>
            老師管理中心
          </h1>

          <p>
            學生、課程與教學狀況總覽
          </p>
        </div>

        <div class="teacher-profile">
          <div class="teacher-profile__text">
            <strong>
              {{
                teacher?.display_name ||
                '老師'
              }}
            </strong>

            <span>
              Teacher
            </span>
          </div>

          <div class="teacher-avatar">
            <img
              v-if="teacher?.picture_url"
              :src="
                teacher.picture_url
              "
              alt="老師頭像"
            >

            <span v-else>
              師
            </span>
          </div>
        </div>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <span class="summary-card__label">
            學生總數
          </span>

          <strong class="summary-card__number">
            {{ studentCount }}
          </strong>

          <span class="summary-card__hint">
            目前系統內的學生
          </span>
        </article>

        <article class="summary-card">
          <span class="summary-card__label">
            LINE 已綁定
          </span>

          <strong class="summary-card__number">
            {{ linkedStudents.length }}
          </strong>

          <span class="summary-card__hint">
            可以使用學生端
          </span>
        </article>

        <article class="summary-card">
          <span class="summary-card__label">
            尚未綁定
          </span>

          <strong class="summary-card__number">
            {{ unlinkedStudents.length }}
          </strong>

          <span class="summary-card__hint">
            仍由老師代為管理
          </span>
        </article>

        <article class="summary-card">
          <span class="summary-card__label">
            課程數量
          </span>

          <strong class="summary-card__number">
            {{ courseCount }}
          </strong>

          <span class="summary-card__hint">
            已建立的課程
          </span>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel">
          <div class="panel__header">
            <div>
              <span class="panel__eyebrow">
                Students
              </span>

              <h2>
                學生列表
              </h2>
            </div>

            <NuxtLink
              to="/teacher/students"
              class="panel__link"
            >
              查看全部
            </NuxtLink>
          </div>

          <div
            v-if="
              activeStudents.length
            "
            class="student-list"
          >
            <NuxtLink
              v-for="student in
                activeStudents.slice(
                  0,
                  8
                )"
              :key="student.id"
              :to="
                `/teacher/students/${student.id}`
              "
              class="student-item"
            >
              <div class="student-avatar">
                {{
                  getStudentName(
                    student
                  ).slice(0, 1)
                }}
              </div>

              <div class="student-info">
                <strong>
                  {{
                    getStudentName(
                      student
                    )
                  }}
                </strong>

                <span>
                  {{
                    getStudentPhone(
                      student
                    ) ||
                    '未設定電話'
                  }}
                </span>
              </div>

              <div
                class="binding-badge"
                :class="{
                  'binding-badge--linked':
                    student.user_id,
                }"
              >
                {{
                  student.user_id
                    ? 'LINE 已綁定'
                    : '未綁定'
                }}
              </div>

              <span class="arrow">
                ›
              </span>
            </NuxtLink>
          </div>

          <div
            v-else
            class="empty-state"
          >
            <span>
              尚未建立學生
            </span>

            <NuxtLink
              to="/teacher/students"
            >
              前往建立學生
            </NuxtLink>
          </div>
        </article>

        <article class="panel">
          <div class="panel__header">
            <div>
              <span class="panel__eyebrow">
                Courses
              </span>

              <h2>
                課程列表
              </h2>
            </div>

            <NuxtLink
              to="/teacher/courses"
              class="panel__link"
            >
              課程管理
            </NuxtLink>
          </div>

          <div
            v-if="courses.length"
            class="course-list"
          >
            <NuxtLink
              v-for="course in
                courses.slice(
                  0,
                  8
                )"
              :key="course.id"
              to="/teacher/courses"
              class="course-item"
            >
              <div class="course-icon">
                ♪
              </div>

              <div class="course-info">
                <strong>
                  {{
                    getCourseName(
                      course
                    )
                  }}
                </strong>

                <span>
                  {{
                    getCourseDescription(
                      course
                    )
                  }}
                </span>
              </div>

              <span class="arrow">
                ›
              </span>
            </NuxtLink>
          </div>

          <div
            v-else
            class="empty-state"
          >
            <span>
              尚未建立課程
            </span>

            <NuxtLink
              to="/teacher/courses"
            >
              前往建立課程
            </NuxtLink>
          </div>
        </article>
      </section>

      <section class="quick-actions">
        <NuxtLink
          to="/teacher/students"
          class="quick-action"
        >
          <span class="quick-action__icon">
            人
          </span>

          <div>
            <strong>
              學生管理
            </strong>

            <span>
              基本資料、方案與紀錄
            </span>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/teacher/courses"
          class="quick-action"
        >
          <span class="quick-action__icon">
            課
          </span>

          <div>
            <strong>
              課程管理
            </strong>

            <span>
              課程與固定時段
            </span>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/teacher/schedule"
          class="quick-action"
        >
          <span class="quick-action__icon">
            日
          </span>

          <div>
            <strong>
              課表與點名
            </strong>

            <span>
              今日課程與出席
            </span>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/teacher/audit"
          class="quick-action"
        >
          <span class="quick-action__icon">
            紀
          </span>

          <div>
            <strong>
              操作紀錄
            </strong>

            <span>
              Audit Log 查詢
            </span>
          </div>
        </NuxtLink>
      </section>
    </div>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  min-height: 100vh;
  padding: 28px 20px 60px;
  background: #f6f6f6;
  color: #222222;
}

.dashboard-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  padding: 6px 4px;
}

.eyebrow,
.panel__eyebrow {
  color: #999999;
  font-size: 12px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.dashboard-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.25;
}

.dashboard-header p {
  margin: 7px 0 0;
  color: #777777;
  font-size: 14px;
}

.teacher-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.teacher-profile__text {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.teacher-profile__text strong {
  font-size: 14px;
}

.teacher-profile__text span {
  margin-top: 2px;
  color: #999999;
  font-size: 12px;
}

.teacher-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #222222;
  border-radius: 50%;
  color: #ffffff;
  font-weight: 700;
}

.teacher-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-bottom: 18px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-height: 142px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 22px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.summary-card__label {
  color: #777777;
  font-size: 13px;
}

.summary-card__number {
  margin-top: 12px;
  font-size: 32px;
  line-height: 1;
}

.summary-card__hint {
  margin-top: auto;
  padding-top: 14px;
  color: #aaaaaa;
  font-size: 12px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 18px;
}

.panel {
  padding: 22px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel__header h2 {
  margin: 4px 0 0;
  font-size: 19px;
}

.panel__link {
  color: #555555;
  font-size: 13px;
  text-decoration: none;
}

.student-list,
.course-list {
  display: flex;
  flex-direction: column;
}

.student-item,
.course-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 10px 4px;
  border-bottom: 1px solid #f0f0f0;
  color: inherit;
  text-decoration: none;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}

.student-item:last-child,
.course-item:last-child {
  border-bottom: 0;
}

.student-item:hover,
.course-item:hover {
  background: #fafafa;
}

.student-avatar,
.course-icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: #f1f1f1;
  border-radius: 14px;
  color: #444444;
  font-size: 14px;
  font-weight: 700;
}

.student-info,
.course-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.student-info strong,
.course-info strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-info span,
.course-info span {
  overflow: hidden;
  margin-top: 4px;
  color: #999999;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-badge {
  flex: 0 0 auto;
  padding: 5px 8px;
  background: #f3f3f3;
  border-radius: 999px;
  color: #999999;
  font-size: 11px;
}

.binding-badge--linked {
  background: #eef8ee;
  color: #4c9650;
}

.arrow {
  flex: 0 0 auto;
  color: #bbbbbb;
  font-size: 22px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #aaaaaa;
  font-size: 13px;
  text-align: center;
}

.empty-state a {
  margin-top: 10px;
  color: #333333;
}

.quick-actions {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-top: 18px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 20px;
  color: inherit;
  text-decoration: none;
}

.quick-action__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}

.quick-action div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.quick-action strong {
  font-size: 13px;
}

.quick-action span:not(
  .quick-action__icon
) {
  margin-top: 3px;
  overflow: hidden;
  color: #999999;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height:
    calc(100vh - 88px);
}

.state-card {
  width: 100%;
  max-width: 380px;
  padding: 34px 26px;
  background: #ffffff;
  border-radius: 26px;
  box-shadow:
    0 18px 60px
    rgb(0 0 0 / 8%);
  text-align: center;
}

.state-card h2 {
  margin: 18px 0 0;
  font-size: 20px;
}

.state-card p {
  margin: 10px 0 0;
  color: #777777;
  font-size: 14px;
  line-height: 1.7;
}

.loader {
  width: 42px;
  height: 42px;
  margin: 0 auto;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading 0.75s
    linear infinite;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 700;
}

.state-icon--error {
  background: #fff0f0;
  color: #d94a4a;
}

.primary-button {
  width: 100%;
  min-height: 46px;
  margin-top: 22px;
  border: 0;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

@keyframes loading {
  to {
    transform: rotate(360deg);
  }
}

@media (
  max-width: 900px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }

  .dashboard-grid {
    grid-template-columns:
      1fr;
  }

  .quick-actions {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }
}

@media (
  max-width: 560px
) {
  .teacher-dashboard {
    padding:
      18px
      14px
      42px;
  }

  .dashboard-header {
    align-items:
      flex-start;
  }

  .dashboard-header h1 {
    font-size: 24px;
  }

  .teacher-profile__text {
    display: none;
  }

  .summary-card {
    min-height: 126px;
    padding: 17px;
  }

  .summary-card__number {
    font-size: 28px;
  }

  .panel {
    padding: 18px;
  }

  .binding-badge {
    display: none;
  }

  .quick-actions {
    grid-template-columns:
      1fr;
  }
}
</style>