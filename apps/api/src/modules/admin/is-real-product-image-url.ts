import { ValidateBy, ValidationOptions } from 'class-validator';
import {
  PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE,
  placeholderProductImageUrlError,
} from './admin-product-images';

/** class-validator: reject placeholder CDNs. Does not rewrite the value. */
export function IsRealProductImageUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isRealProductImageUrl',
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string') return true;
          return placeholderProductImageUrlError(value) == null;
        },
        defaultMessage: () => PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE,
      },
    },
    validationOptions,
  );
}
