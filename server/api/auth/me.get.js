import {
  getAuthUser,
} from '../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    const user =
      await getAuthUser(
        event
      )

    if (!user) {
      return {
        authenticated: false,
        user: null,
      }
    }

    return {
      authenticated: true,

      user: {
        id:
          user.id,

        displayName:
          user.display_name,

        pictureUrl:
          user.picture_url,

        role:
          user.role,
      },
    }
  }
)