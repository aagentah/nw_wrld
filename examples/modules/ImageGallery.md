# ImageGallery

A module for displaying and navigating through image files from a local directory.

## Preview

 Simple example | Placed in a grid with the OrbitalPlane module |
|---|---|
| ![Simple Example](../screenshots/imagegallery_simple.gif) | ![Grid example](../screenshots/imagegallery_grid.gif) |

## What It Does

ImageGallery loads all image files from a specified directory and provides methods to navigate through them. The module checks for common image formats like `.jpg` and `.png`

All images automatically scale to fit the module container while maintaining their aspect ratio using `object-fit: cover`.

## Methods

### setImageDirectory

Loads all image files from a specified directory path.

**Parameters:**
- `directory` - The absolute path to a folder containing images

**Example:** `/Users/username/Pictures/gallery`

### setIndex

Displays the image at the specified index. Index must be within the range of available images (0 to length-1). Invalid indices are ignored.

**Parameters:**
- `index` (number, default: `0`, min: `0`) - The index of the image to display

**Example:** Setting index to `2` shows the third image in the directory.

### shift

Shifts the current index forward or backward by the specified amount. Wraps around to the beginning/end if required.

**Parameters:**
- `amount` (number, default: `1`) - How many steps to shift (positive = forward, negative = backward)

**Example:** With 5 images loaded, if you're at index 4 and shift by 1, it wraps to index 0. Shift by -2 to go back two images.

### random

Selects a random image.

**No parameters**

## Example Usage

- Add the module
- Configure the constructor, set the default image directory using the `setImageGallery` method
- Create a new module channel, add the `shift` method with `amount = 1`
- Trigger the channel. The images are shown in sequence.

## Tips

- **Performance:** All images are preloaded into memory. With large directories or high-resolution images, initial load time may be slow and memory usage will be high.

- **Empty Directory:** If the directory is empty or contains no valid images, the module will not display anything and methods will be ignored.

- **Error Handling:** Check the render console for errors if images fail to load.