import { Response } from 'express';
import { ApiResponse, ErrorType } from '@/types';
import config from '@/config';

/**
 * Standard API response formatter
 */
export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data?: T,
  message?: string,
  requestId?: string
): void => {
  const response: ApiResponse<T> = {
    success: statusCode >= 200 && statusCode < 300,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
    version: config.apiVersion,
  };

  res.status(statusCode).json(response);
};

/**
 * Success response
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  requestId?: string,
  statusCode: number = 200
): void => {
  sendResponse(res, statusCode, data, message, requestId);
};

/**
 * Created response
 */
export const sendCreated = <T>(
  res: Response,
  data?: T,
  message?: string,
  requestId?: string
): void => {
  sendResponse(res, 201, data, message || 'Resource created successfully', requestId);
};

/**
 * No content response
 */
export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};

/**
 * Error response
 */
export const sendError = (
  res: Response,
  statusCode: number,
  errorCode: ErrorType,
  message: string,
  details?: any,
  requestId?: string
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    requestId,
    version: config.apiVersion,
  };

  res.status(statusCode).json(response);
};

/**
 * Bad request error (400)
 */
export const sendBadRequest = (
  res: Response,
  message: string = 'Bad Request',
  details?: any,
  requestId?: string
): void => {
  sendError(res, 400, 'VALIDATION_ERROR', message, details, requestId);
};

/**
 * Unauthorized error (401)
 */
export const sendUnauthorized = (
  res: Response,
  message: string = 'Authentication required',
  requestId?: string
): void => {
  sendError(res, 401, 'AUTHENTICATION_ERROR', message, undefined, requestId);
};

/**
 * Forbidden error (403)
 */
export const sendForbidden = (
  res: Response,
  message: string = 'Access forbidden',
  requestId?: string
): void => {
  sendError(res, 403, 'AUTHORIZATION_ERROR', message, undefined, requestId);
};

/**
 * Not found error (404)
 */
export const sendNotFound = (
  res: Response,
  message: string = 'Resource not found',
  requestId?: string
): void => {
  sendError(res, 404, 'NOT_FOUND_ERROR', message, undefined, requestId);
};

/**
 * Conflict error (409)
 */
export const sendConflict = (
  res: Response,
  message: string = 'Resource conflict',
  details?: any,
  requestId?: string
): void => {
  sendError(res, 409, 'VALIDATION_ERROR', message, details, requestId);
};

/**
 * Unprocessable entity error (422)
 */
export const sendUnprocessableEntity = (
  res: Response,
  message: string = 'Validation failed',
  details?: any,
  requestId?: string
): void => {
  sendError(res, 422, 'VALIDATION_ERROR', message, details, requestId);
};

/**
 * Rate limit error (429)
 */
export const sendRateLimit = (
  res: Response,
  message: string = 'Too many requests',
  requestId?: string
): void => {
  sendError(res, 429, 'RATE_LIMIT_ERROR', message, undefined, requestId);
};

/**
 * Internal server error (500)
 */
export const sendInternalError = (
  res: Response,
  message: string = 'Internal server error',
  details?: any,
  requestId?: string
): void => {
  sendError(res, 500, 'INTERNAL_ERROR', message, details, requestId);
};

/**
 * Bad gateway error (502)
 */
export const sendBadGateway = (
  res: Response,
  message: string = 'Bad gateway',
  requestId?: string
): void => {
  sendError(res, 502, 'BAD_GATEWAY', message, undefined, requestId);
};

/**
 * Service unavailable error (503)
 */
export const sendServiceUnavailable = (
  res: Response,
  message: string = 'Service temporarily unavailable',
  requestId?: string
): void => {
  sendError(res, 503, 'SERVICE_UNAVAILABLE', message, undefined, requestId);
};

/**
 * Gateway timeout error (504)
 */
export const sendGatewayTimeout = (
  res: Response,
  message: string = 'Gateway timeout',
  requestId?: string
): void => {
  sendError(res, 504, 'GATEWAY_TIMEOUT', message, undefined, requestId);
};

/**
 * Proxy error response handler
 */
export const handleProxyError = (
  error: any,
  res: Response,
  requestId?: string
): void => {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    sendServiceUnavailable(res, 'Service is currently unavailable', requestId);
  } else if (error.code === 'ETIMEDOUT' || error.timeout) {
    sendGatewayTimeout(res, 'Request timeout', requestId);
  } else if (error.status) {
    // Forward the status from the proxied service
    sendError(res, error.status, 'BAD_GATEWAY', error.message || 'Service error', undefined, requestId);
  } else {
    sendBadGateway(res, 'Failed to connect to service', requestId);
  }
};

/**
 * Validation error response
 */
export const sendValidationError = (
  res: Response,
  errors: Array<{ field: string; message: string; code?: string }>,
  requestId?: string
): void => {
  sendError(
    res,
    422,
    'VALIDATION_ERROR',
    'Validation failed',
    errors,
    requestId
  );
};

export default {
  sendResponse,
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendUnprocessableEntity,
  sendRateLimit,
  sendInternalError,
  sendBadGateway,
  sendServiceUnavailable,
  sendGatewayTimeout,
  handleProxyError,
  sendValidationError,
};