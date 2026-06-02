Add-Type -AssemblyName System.Drawing

foreach ($size in 192, 512) {
  $bmp = New-Object Drawing.Bitmap $size, $size
  $g = [Drawing.Graphics]::FromImage($bmp)

  $g.Clear([Drawing.Color]::FromArgb(17, 24, 39))

  $font = New-Object Drawing.Font("Arial", [int]($size / 3), [Drawing.FontStyle]::Bold)
  $brush = [Drawing.Brushes]::White
  $text = "JC"

  $format = New-Object Drawing.StringFormat
  $format.Alignment = "Center"
  $format.LineAlignment = "Center"

  $rect = New-Object Drawing.RectangleF 0, 0, $size, $size

  $g.DrawString($text, $font, $brush, $rect, $format)

  $bmp.Save("public/icon-$size.png", [Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
}