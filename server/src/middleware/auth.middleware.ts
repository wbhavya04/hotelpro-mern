import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/jwt';
import { User, IUser, UserRole } from '../models/User.model';
import { StaffAssignment } from '../models/StaffAssignment.model';
import { Hotel } from '../models/Hotel.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      assignedHotelIds?: string[];
    }
  }
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Authentication required. Please sign in to continue.', 'UNAUTHORIZED');
  }

  let decoded;
  try {
    decoded = verifyAuthToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired authentication token.', 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'Account associated with this token no longer exists.', 'USER_NOT_FOUND');
  }

  if (user.accountStatus === 'suspended') {
    throw new ApiError(403, 'Your account has been suspended by an administrator.', 'ACCOUNT_SUSPENDED');
  }

  req.user = user;
  next();
});

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.', 'UNAUTHORIZED'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
          'FORBIDDEN_ROLE'
        )
      );
    }
    next();
  };
};

export async function verifyHotelScope(user: IUser, hotelId: string): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (user.role === 'manager') {
    const managedHotel = await Hotel.exists({ _id: hotelId, managers: user._id });
    if (managedHotel) return true;
  }

  const assignment = await StaffAssignment.exists({
    staff: user._id,
    hotel: hotelId,
    isActive: true
  });

  return Boolean(assignment);
}

export async function getAssignedHotelIds(user: IUser): Promise<string[]> {
  if (user.role === 'admin') {
    const all = await Hotel.find({}, '_id').lean();
    return all.map((h) => String(h._id));
  }

  const assignments = await StaffAssignment.find({ staff: user._id, isActive: true }, 'hotel').lean();
  const ids = new Set<string>(assignments.map((a) => String(a.hotel)));

  if (user.role === 'manager') {
    const managed = await Hotel.find({ managers: user._id }, '_id').lean();
    managed.forEach((h) => ids.add(String(h._id)));
  }

  return Array.from(ids);
}
